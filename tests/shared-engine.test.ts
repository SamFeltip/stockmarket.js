import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setup } from "./game-setup";
import { api, internal } from "../convex/_generated/api";
import type { Doc as Document_ } from "../convex/_generated/dataModel";
import type { Table } from "../../stockmarket-shared/src/engine/model";
import { GameEnvironment, npcAction, emptyMemory } from "../../stockmarket-ai/src";
import type { EnvironmentSnapshot, NpcMemory } from "../../stockmarket-ai/src";
import { SeededRandom } from "../../stockmarket-ai/src/random";
import { pendingSuspensions } from "../shared/suspensions";

const tables = ["games", "players", "users", "stocks", "insights", "playerInsights", "gameCatalogs",
    "gameActions", "periodSummaries", "feed"] as const satisfies readonly Table[];

beforeEach(() => vi.useFakeTimers());
afterEach(() =>
{
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
});

it("replays a full game identically through Convex endpoints and the in-memory adapter", async () =>
{
    const { t, sam, clients } = await setup();

    const liveRandom = new SeededRandom(718);

    vi.spyOn(Math, "random").mockImplementation(() => liveRandom.next());
    await sam.mutation(api.games.start, { code: "test" });
    const opened = await sam.query(api.board.get, { code: "test" });
    const clientByPlayer = new Map(await Promise.all(clients.map(async (client) =>
    {
        const board = await client.query(api.board.get, { code: "test" });

        return [board.player._id, client] as const;
    })));
    const imported = await t.run(async (context) =>
    {
        const rows: EnvironmentSnapshot["store"]["rows"] = [];
        const locations: [string, Table][] = [];
        for (const table of tables)
        {
            const documents = await context.db.query(table).collect();

            rows.push(...documents);
            locations.push(...documents.map((document) => [document._id, table] as [string, Table]));
        }

        return { rows, tables: locations, sequence: rows.length };
    });
    const environment = GameEnvironment.fromSnapshot({
        store: imported, randomState: liveRandom.state, gameId: opened.game._id,
    });
    const memories = new Map<string, NpcMemory>();
    const phases = new Set<string>();
    const kinds = new Set<string>();
    let result = await environment.current();
    let steps = 0;

    while (result.decision)
    {
        const decision = result.decision;
        const selected = npcAction(decision, { personality: "morgan", difficulty: "medium" },
            memories.get(decision.playerId) ?? emptyMemory(), `parity:${decision.token}`);
        const action = selected.action;
        const client = clientByPlayer.get(decision.playerId)!;
        const board = await client.query(api.board.get, { code: "test" });
        const liveCards = await t.run(async (context) => context.db.query("playerInsights").collect());
        const memoryCards = environment.snapshot().store.rows.filter((row): row is Document_<"playerInsights"> =>
            "catalogCardId" in row);
        const insightId = "insightId" in action ? liveCards.find((card) =>
        {
            const original = memoryCards.find((item) => item._id === action.insightId)!;

            return card.catalogCardId === original.catalogCardId && card.period === original.period
              && card.playerId === original.playerId;
        })!._id : undefined;

        phases.add(decision.phase);
        kinds.add(action.kind);

        switch (action.kind)
        {
            case "rights-response": {
                await client.mutation(api.rightsIssue.decide, { code: "test", insightId: board.game.rightsIssue!.insightId,
                    expectedIndex: board.game.rightsIssue!.index, quantity: action.quantity });
                break;
            }
            case "suspend": {
                const queue = pendingSuspensions(board.game.currentPeriod, board.players, liveCards);

                await client.mutation(api.rounds.suspendShare, { code: "test", expectedPeriod: board.game.currentPeriod,
                    insightId: queue[0]._id, stockKey: action.stockKey });
                break;
            }
            case "hold-stock": {
                throw new Error("Retail games do not deal legacy hold-stock cards");
            }
            case "rights-issue": {
                await client.mutation(api.rightsIssue.activate, { code: "test", expectedPeriod: board.game.currentPeriod,
                    expectedTurn: board.game.turn, insightId: insightId!, stockKey: action.stockKey });
                break;
            }
            case "government-loan": {
                await client.mutation(api.trading.activateGovernmentLoan, { code: "test",
                    expectedPeriod: board.game.currentPeriod, expectedTurn: board.game.turn, insightId: insightId! });
                break;
            }
            case "debenture": {
                await client.mutation(api.trading.redeemDebenture, { code: "test", expectedPeriod: board.game.currentPeriod,
                    expectedTurn: board.game.turn, insightId: insightId!, stockKey: action.stockKey });
                break;
            }
            default: {
                await client.mutation(api.trading.play, { code: "test", expectedPeriod: board.game.currentPeriod,
                    expectedTurn: board.game.turn, stockKey: action.kind === "pass" ? undefined : action.stockKey,
                    quantity: action.kind === "pass" ? undefined : action.quantity * (action.kind === "buy" ? 1 : -1) });
            }
        }

        result = await environment.step(action, decision.token);
        memories.set(decision.playerId, selected.nextMemory);
        let live = await sam.query(api.board.get, { code: "test" });
        if (live.game.rightsIssue?.completed)
        {
            await t.mutation(internal.rightsIssue.finish,
                { gameId: live.game._id, insightId: live.game.rightsIssue.insightId });
            live = await sam.query(api.board.get, { code: "test" });
        }

        if (live.game.status === "closed")
        {
            await sam.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: live.game.currentPeriod });
            const cards = await t.run(async (context) => context.db.query("playerInsights").collect());
            if (pendingSuspensions(live.game.currentPeriod, live.players, cards).length === 0)
            {
                await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: live.game.currentPeriod });
            }
        }

        const snapshot = environment.snapshot();
        const state = snapshot.store.rows.find((row): row is Document_<"games"> => row._id === snapshot.gameId)!;
        const actual = await sam.query(api.board.get, { code: "test" });

        expect(actual.game).toMatchObject({ status: state.status, currentPeriod: state.currentPeriod,
            turn: state.turn, prices: state.prices, priceHistory: state.priceHistory, suspended: state.suspended,
            currentPlayerId: state.currentPlayerId });
        const expectedPlayers = snapshot.store.rows.filter((row): row is Document_<"players"> =>
            snapshot.store.tables.some(([id, table]) => id === row._id && table === "players"));
        const actualPlayers = await t.run(async (context) => context.db.query("players").collect());
        for (const player of expectedPlayers)
        {
            expect(actualPlayers.find((seat) => seat._id === player._id)).toMatchObject({ cash: player.cash,
                holdings: player.holdings });
            const actualPlayer = actualPlayers.find((seat) => seat._id === player._id)!;

            expect(actualPlayer.chairmanSince).toEqual(player.chairmanSince);
            expect(actualPlayer.directorSince).toEqual(player.directorSince);
        }

        const canonicalCards = (cards: Document_<"playerInsights">[]) => cards.map((card) => ({
            playerId: card.playerId, period: card.period, catalogCardId: card.catalogCardId,
            used: card.used ?? false, resolved: card.resolved,
        })).toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        const expectedCards = snapshot.store.rows.filter((row): row is Document_<"playerInsights"> =>
            snapshot.store.tables.some(([id, table]) => id === row._id && table === "playerInsights"));

        expect(canonicalCards(await t.run(async (context) => context.db.query("playerInsights").collect())))
            .toEqual(canonicalCards(expectedCards));
        expect(++steps).toBeLessThan(1000);
    }

    expect(result.finished).toBe(true);
    expect(phases).toContain("suspension");
    expect(kinds).toContain("government-loan");
});
