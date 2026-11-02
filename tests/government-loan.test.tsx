import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { api } from "../convex/_generated/api";
import { chanceStockKey, governmentLoanAmount } from "../shared/chance-cards";
import { PlayAnimation } from "../src/PlayAnimation";
import { newPlayEvents } from "../src/play-events";
import { buildNpcObservation } from "../convex/npc/observation";
import { setup } from "./game-setup";

async function loanGame()
{
    const fixture = await setup();

    await fixture.sam.mutation(api.games.start, { code: "test" });
    const board = await fixture.sam.query(api.board.get, { code: "test" });
    const insightId = await fixture.t.run(async (context) => await context.db.insert("playerInsights", {
        gameId: board.game._id, playerId: board.player._id, period: board.game.currentPeriod,
        stockKey: chanceStockKey, chanceKind: "loan", value: 0, resolved: false,
        description: "Government Loan",
    }));

    return { ...fixture, board, insightId, command: { code: "test", expectedTurn: 0, expectedPeriod: 0, insightId } };
}

it("redeems the owned loan once, adds £10,000, spends one turn and broadcasts the money popup", async () =>
{
    const { t, sam, clients, board, insightId, command } = await loanGame();

    await sam.mutation(api.trading.activateGovernmentLoan, command);
    const after = await sam.query(api.board.get, { code: "test" });
    const publicBoard = (await sam.query(api.tv.board, { code: "test" }))!;
    const event = after.feed[0];

    expect(after.player.cash).toBe(board.player.cash + governmentLoanAmount);
    expect(after.player.holdings).toEqual(board.player.holdings);
    expect(after.game.turn).toBe(1);
    expect(after.game.currentPlayerId).toBe(after.players[1]._id);
    expect(after.insights.find((card) => card._id === insightId)?.used).toBe(true);
    expect(event).toMatchObject({ cashBonus: governmentLoanAmount, message: "received government bonus" });
    expect(publicBoard.feed[0].cashBonus).toBe(governmentLoanAmount);
    expect(newPlayEvents(after, board.feed[0]?._id, board.feed[0]?._creationTime ?? 0)).toContainEqual(event);
    const popup = renderToStaticMarkup(<PlayAnimation board={{ ...after, feed: [event] }} preview />);

    expect(popup).toContain("/static/imgs/icons/cash.svg");
    expect(popup).toContain("£10,000");
    expect(popup).toContain("received government bonus");
    expect(popup).not.toContain("Purchased");
    await expect(sam.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow();

    for (const [index, player] of clients.slice(1).entries())
    {
        await player.mutation(api.trading.play, { code: "test", expectedTurn: index + 1, expectedPeriod: 0 });
    }

    await expect(sam.mutation(api.trading.activateGovernmentLoan, { ...command, expectedTurn: 4 }))
        .rejects.toThrow("cannot be used");
    const actions = await t.run(async (context) => await context.db.query("gameActions").collect());

    expect(actions.filter((item) => item.action.kind === "government-loan")).toHaveLength(1);
    const observation = await t.run(async (context) =>
    {
        const game = (await context.db.get(board.game._id))!;
        const player = (await context.db.get(board.player._id))!;

        return await buildNpcObservation(context, game, player);
    });

    expect(observation.events[0].action).toEqual({ kind: "pass" });
});

it("rejects stale turns, periods, outsiders, another player's card and unsupported chance powers without credit", async () =>
{
    const { t, sam, bob, outsider, board, insightId, command } = await loanGame();

    await expect(sam.mutation(api.trading.activateGovernmentLoan, { ...command, expectedTurn: 1 })).rejects.toThrow("turn has changed");
    await expect(sam.mutation(api.trading.activateGovernmentLoan, { ...command, expectedPeriod: 1 })).rejects.toThrow("turn has changed");
    await expect(outsider.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow();
    await expect(bob.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow("not your turn");
    await t.run(async (context) => await context.db.patch(insightId, { chanceKind: "rights" }));
    await expect(sam.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow("cannot be used");
    await t.run(async (context) => await context.db.patch(insightId, { chanceKind: "loan", period: 1 }));
    await expect(sam.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow("cannot be used");
    await t.run(async (context) => await context.db.patch(insightId, { period: 0, playerId: board.players[1]._id }));
    await expect(sam.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow("cannot be used");
    await sam.mutation(api.games.create, { code: "other", periodCount: 5 });
    const other = await sam.query(api.board.get, { code: "other" });

    await t.run(async (context) => await context.db.patch(insightId, {
        gameId: other.game._id, playerId: board.player._id,
    }));
    await expect(sam.mutation(api.trading.activateGovernmentLoan, command)).rejects.toThrow("cannot be used");
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.player.cash).toBe(board.player.cash);
    expect(after.game.turn).toBe(0);
    expect(await t.run(async (context) => await context.db.query("gameActions").collect())).toHaveLength(0);
});

it("closes trading when redeeming the loan is the final turn, before the cash reveal", async () =>
{
    const { t, sam, board, command } = await loanGame();
    const lastTurn = board.players.length * 3 - 1;

    await t.run(async (context) => await context.db.patch(board.game._id, { turn: lastTurn }));
    await sam.mutation(api.trading.activateGovernmentLoan, { ...command, expectedTurn: lastTurn });
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.game.status).toBe("closed");
    expect(after.game.turn).toBe(lastTurn + 1);
    expect(after.player.cash).toBe(board.player.cash + governmentLoanAmount);
    await expect(sam.mutation(api.trading.activateGovernmentLoan, { ...command, expectedTurn: lastTurn + 1 }))
        .rejects.toThrow("not your turn");
});
