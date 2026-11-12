import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { applyTurn } from "../../convex/game/commands";
import { buildNpcObservation } from "../../convex/npc/observation";
import { decide, emptyMemory, isLegalProposal, roster } from "../../packages/npc-engine/src";
import { rightsPurchase, suspensionChoice } from "../../packages/npc-engine/src/chance";
import { chanceStockKey } from "../../shared/chance-cards";
import { setup } from "../game-setup";
import { observation } from "./fixtures";

beforeEach(() => vi.useFakeTimers());
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});

async function fixture(kind: "loan" | "debenture" | "rights")
{
    const result = await setup(5, 1);
    const { t, sam } = result;

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });
    const npc = board.players[1];
    const insightId = await t.run(async (context) =>
    {
        for (const card of await context.db.query("playerInsights").collect())
        {
            if (card.chanceKind)
            {
                await context.db.delete(card._id);
            }
        }

        await context.db.patch(npc._id, { holdings: [{ stockKey: 8, quantity: 10_000 }], cash: 5000 });

        return await context.db.insert("playerInsights", { gameId: board.game._id, playerId: npc._id,
            period: 0, stockKey: chanceStockKey, chanceKind: kind, description: kind, value: 0, resolved: false });
    });

    await sam.mutation(api.trading.play, { code: "test", expectedPeriod: 0, expectedTurn: 0 });
    const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;
    const job = { pendingId: pending._id, generation: pending.generation };
    const observe = () => t.run(async (context) => buildNpcObservation(context,
        (await context.db.get(board.game._id))!, (await context.db.get(npc._id))!));

    return { ...result, board, npc, insightId, job, observe };
}

it("allows every personality and difficulty to play chance cards and checks exact ownership and target", () =>
{
    const action = { kind: "government-loan", insightId: "own-card" } as const;
    const input = observation({ chanceOffers: [{ action, amount: 10_000 }] });
    for (const personality of roster)
    {
        for (const difficulty of ["easy", "medium", "hard"] as const)
        {
            expect(decide(input, { personality: personality.id, difficulty }, emptyMemory(), "cards").action)
                .toEqual(action);
        }
    }

    expect(isLegalProposal({ ...action, insightId: "opponent-card" }, [action])).toBe(false);
    const rights = { kind: "rights-issue", insightId: "rights", stockKey: 8 } as const;

    expect(isLegalProposal({ ...rights, stockKey: 9 }, [rights])).toBe(false);
    expect(isLegalProposal(rights, [rights])).toBe(true);
});

it("redeems a Government Loan once through a scheduled turn and records the real action", async () =>
{
    const { t, sam, npc, insightId, job } = await fixture("loan");

    await t.mutation(internal.npc.worker.run, job);
    await t.mutation(internal.npc.worker.run, job);
    const board = await sam.query(api.board.get, { code: "test" });

    expect(board.players.find((seat) => seat._id === npc._id)?.cash).toBe(15_000);
    expect(board.game.turn).toBe(2);
    expect(await t.run(async (context) => context.db.get(insightId))).toMatchObject({ used: true });
    expect(await t.run(async (context) => context.db.query("npcTraces").unique()))
        .toMatchObject({ action: { kind: "government-loan", insightId }, reason: "cards" });
});

it("claims retained Debentures at the opening price and excludes expired claims and spent cards", async () =>
{
    const { t, board, npc, insightId, job, observe } = await fixture("debenture");

    await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { currentPeriod: 1,
            prices: board.game.prices.map((price) => price.stockKey === 8 ? { ...price, value: 0 } : price),
            priceHistory: [{ period: 0, prices: board.game.prices },
                { period: 1, prices: [{ stockKey: 8, value: 0 }] }] });
        await context.db.patch(job.pendingId, { period: 1 });
    });
    const input = await observe();
    const opening = board.game.prices.find((price) => price.stockKey === 8)!.value;

    expect(input.legalActions.filter((action) => action.kind !== "pass" && action.stockKey === 8)).toEqual([]);

    for (const kind of ["buy", "sell"] as const)
    {
        await expect(t.run((context) => applyTurn(context, {
            playerId: npc._id, expectedPeriod: 1, expectedTurn: 1, action: { kind, stockKey: 8, quantity: 1000 },
        }, { name: npc.name, profileRoot: npc.profileRoot }))).rejects.toThrow("This stock cannot be traded");
    }

    expect(input.chanceOffers).toEqual([{ action: { kind: "debenture", insightId, stockKey: 8 },
        amount: opening * 10_000 }]);
    await t.run(async (context) => context.db.patch(board.game._id, { currentPeriod: 3 }));
    expect((await observe()).chanceOffers).toEqual([]);
    await t.run(async (context) => context.db.patch(board.game._id, { currentPeriod: 1 }));
    await t.mutation(internal.npc.worker.run, job);
    const player = (await t.run(async (context) => context.db.get(npc._id)))!;

    expect(player.cash).toBe(5000 + opening * 10_000);
    expect(player.holdings).toEqual([{ stockKey: 8, quantity: 0 }]);
    expect(await t.run((context) => context.db.query("npcTraces").unique()))
        .toMatchObject({ action: { kind: "debenture", insightId, stockKey: 8 } });
    expect((await observe()).chanceOffers).toEqual([]);
});

it("opens a Rights Issue, buys the AI entitlement, waits for a human and resumes the next scheduled turn", async () =>
{
    const { t, sam, board, npc, insightId, job } = await fixture("rights");

    await t.run(async (context) =>
    {
        await context.db.patch(board.player._id, { holdings: [{ stockKey: 8, quantity: 4000 }] });
    });
    await t.mutation(internal.npc.worker.run, job);
    await t.mutation(internal.npc.worker.run, job);
    const considering = await sam.query(api.board.get, { code: "test" });

    expect(considering.game.rightsIssue?.index).toBe(0);
    expect(considering.game.rightsIssue?.offers[0].purchased).toBeUndefined();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const paused = await sam.query(api.board.get, { code: "test" });

    expect(paused.game.turn).toBe(1);
    expect(paused.game.rightsIssue).toMatchObject({ insightId, index: 1,
        offers: [{ playerId: npc._id, purchased: 5000 }, { playerId: board.player._id }] });
    expect(await t.run(async (context) => context.db.query("npcTurns").collect())).toEqual([]);
    await sam.mutation(api.rightsIssue.decide, { code: "test", insightId, expectedIndex: 1, quantity: 2000 });
    await t.mutation(internal.rightsIssue.finish, { gameId: board.game._id, insightId });
    await t.mutation(internal.rightsIssue.finish, { gameId: board.game._id, insightId });
    const resumed = await sam.query(api.board.get, { code: "test" });

    expect(resumed.game.turn).toBe(2);
    expect(resumed.game.rightsIssue).toBeUndefined();
    expect(resumed.players.find((seat) => seat._id === npc._id)?.cash).toBe(0);
    expect(await t.run(async (context) => context.db.query("npcTurns").unique()))
        .toMatchObject({ turn: 2, playerId: board.players[2]._id });
    expect(await t.run(async (context) => context.db.query("npcTraces").unique()))
        .toMatchObject({ action: { kind: "rights-issue", insightId, stockKey: 8 } });
});

it("ignores expired loans, used cards and unprofitable Rights Issues", async () =>
{
    const { t, board, insightId, observe } = await fixture("loan");

    await t.run(async (context) => context.db.patch(insightId, { used: true }));
    expect((await observe()).chanceOffers).toEqual([]);
    await t.run(async (context) =>
    {
        await context.db.patch(insightId, { used: false });
        await context.db.patch(board.game._id, { currentPeriod: 1 });
    });
    expect((await observe()).chanceOffers).toEqual([]);
    await t.run(async (context) =>
    {
        await context.db.patch(insightId, { chanceKind: "rights", period: 1 });
        await context.db.patch(board.game._id, { prices: [{ stockKey: 8, value: 1 }] });
    });
    expect((await observe()).chanceOffers).toEqual([]);
    expect(rightsPurchase(2, 1000, 500, 200)).toBe(0);
    expect(rightsPurchase(2, 3500, 2900, 2500)).toBe(2000);
    expect(rightsPurchase(0, 1000, 500, 200)).toBe(0);
    expect(suspensionChoice([{ stockKey: 8, quantity: 1000 }], [{ stockKey: 8, value: 2 }],
        [{ stockKey: 8, value: 1 }], [])).toBe(8);
    expect(suspensionChoice([{ stockKey: 8, quantity: 1000 }], [{ stockKey: 8, value: 2 }],
        [{ stockKey: 8, value: 1 }], [8])).toBeUndefined();
});

it("charges the exact Tech Rights Issue price without letting NPCs buy beyond their cash", async () =>
{
    const { t, sam } = await setup(5, 1);
    const code = "test";

    await sam.mutation(api.games.setPack, { code, pack: "tech" });
    await sam.mutation(api.npc.lobby.add, { code, required: true });
    await sam.mutation(api.games.start, { code });
    const board = await sam.query(api.board.get, { code });
    const [, atBudget, belowBudget] = board.players;
    const [{ stockKey }] = board.game.prices;
    const insightId = await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, {
            prices: board.game.prices.map((price) => price.stockKey === stockKey ? { ...price, value: 0.18 } : price),
        });

        for (const [seat, cash] of [[atBudget, 140], [belowBudget, 139.99]] as const)
        {
            await context.db.patch(seat._id, { cash, holdings: seat.holdings.map((holding) =>
                holding.stockKey === stockKey ? { ...holding, quantity: 4000 } : holding) });
        }

        return context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
            period: 0, stockKey: chanceStockKey, chanceKind: "rights", description: "rights", value: 0, resolved: false });
    });

    await sam.mutation(api.rightsIssue.activate, { code, expectedPeriod: 0, expectedTurn: 0, insightId, stockKey });
    await t.mutation(internal.npc.rightsIssue.run, { gameId: board.game._id, insightId, index: 0 });
    await t.mutation(internal.npc.rightsIssue.run, { gameId: board.game._id, insightId, index: 0 });
    await t.mutation(internal.npc.rightsIssue.run, { gameId: board.game._id, insightId, index: 1 });
    const after = await sam.query(api.board.get, { code });
    const purchased = after.players.find((seat) => seat._id === atBudget._id);
    const skipped = after.players.find((seat) => seat._id === belowBudget._id);

    expect(purchased?.cash).toBe(0);
    expect(purchased?.holdings.find((holding) => holding.stockKey === stockKey)?.quantity).toBe(5000);
    expect(skipped?.cash).toBe(139.99);
    expect(skipped?.holdings.find((holding) => holding.stockKey === stockKey)?.quantity).toBe(4000);
});

it("excludes hidden stocks from an NPC's Rights Issue options even when a legacy save has a quote", async () =>
{
    const { t, board, npc, observe } = await fixture("rights");
    const hidden = 999;

    await t.run(async (context) =>
    {
        const player = (await context.db.get(npc._id))!;

        await context.db.insert("stocks", { key: hidden, name: "Hidden", display: false,
            startingValue: 100, variation: 1, imagePath: "", secondaryImagePath: "" });
        await context.db.patch(npc._id, { holdings: [...player.holdings, { stockKey: hidden, quantity: 20_000 }] });
        await context.db.patch(board.game._id, { prices: [...board.game.prices, { stockKey: hidden, value: 100 }] });
    });
    const options = (await observe()).chanceOffers;

    expect(options).toHaveLength(1);
    expect(options?.[0].action).toMatchObject({ kind: "rights-issue", stockKey: 8 });
});
