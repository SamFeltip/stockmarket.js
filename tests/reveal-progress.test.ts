import { expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { suspensionFixture } from "./suspension-setup";

it("shares manual reveal jumps and opens suspensions after the last group", async () =>
{
    const { t, sam, bob, board } = await suspensionFixture();
    const round = { code: "test", expectedPeriod: 1 };
    const move = api.rounds.moveReveal;

    await t.mutation(move, { ...round, step: 0, summary: true });
    const phone = await bob.query(api.board.get, { code: round.code });

    expect(phone.game.revealProgress).toEqual({ step: 0, summary: true });
    await expect(t.mutation(move, { ...round, step: 2, summary: false })).rejects.toThrow("Invalid reveal step");
    await sam.mutation(move, { ...round, step: 1, summary: false });
    await t.mutation(move, { ...round, step: 0, summary: true }); // A delayed click can't rewind other screens.
    const display = await t.query(api.tv.board, { code: round.code });

    expect(display?.reveal?.revealProgress).toEqual({ step: 1, summary: false });

    const end = board.stocks.filter((stock) => stock.display).length + 1;
    for (let step = 2; step <= end; step++)
    {
        await t.mutation(move, { ...round, step, summary: false });
    }

    expect((await sam.query(api.board.get, { code: round.code })).game.suspensionPeriod).toBe(1);
});

it("lets a Frantic NPC deny gains on one stock to its shareholders without targeting other rivals", async () =>
{
    const { t, sam, board, bobCard } = await suspensionFixture("frantic");
    const [rival, npc, otherRival] = board.players;

    await t.run(async (context) =>
    {
        await context.db.patch(npc._id, { controller: { kind: "npc", personality: "morgan" }, userId: undefined,
            holdings: [{ stockKey: 8, quantity: 0 }, { stockKey: 12, quantity: 0 }] });
        await context.db.patch(rival._id, {
            holdings: [{ stockKey: 8, quantity: 5000 }, { stockKey: 12, quantity: 3000 }],
        });
        await context.db.patch(otherRival._id, {
            holdings: [{ stockKey: 8, quantity: 2000 }, { stockKey: 12, quantity: 0 }],
        });
        await context.db.insert("playerInsights", { gameId: board.game._id, playerId: rival._id,
            period: 1, stockKey: 8, value: 2, description: "Test movement", resolved: false });
    });

    await sam.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    await t.mutation(internal.npc.suspensions.run, { gameId: board.game._id, insightId: bobCard });
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.game.targetedSuspensions).toEqual([{ stockKey: 8, playerIds: [rival._id, otherRival._id] }]);
    expect(after.insights.find((card) => card._id === bobCard)?.used).toBe(true);
    await t.mutation(internal.npc.suspensions.run, { gameId: board.game._id, insightId: bobCard });
    expect((await sam.query(api.board.get, { code: "test" })).game.targetedSuspensions)
        .toEqual(after.game.targetedSuspensions);
});
