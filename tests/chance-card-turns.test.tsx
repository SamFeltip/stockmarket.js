import { ConvexProvider, ConvexReactClient } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chanceStockKey } from "../shared/chance-cards";
import { GovernmentLoanModal } from "../src/GovernmentLoanModal";
import { DebentureModal } from "../src/DebentureModal";
import { bankruptGame } from "./debenture-setup";

const client = new ConvexReactClient("https://chance-turns-test.invalid");

it("refuses valid owned chance cards outside your turn without spending cards or changing cash or holdings", async () =>
{
    const { t, sam, board, insightId, command } = await bankruptGame();
    const loanId = await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { currentPlayerId: board.players[1]._id,
            currentUserId: board.players[1].userId });

        return await context.db.insert("playerInsights", { gameId: board.game._id,
            playerId: board.player._id, period: board.game.currentPeriod,
            stockKey: chanceStockKey, chanceKind: "loan", value: 0, description: "Government Loan", resolved: false });
    });
    const before = await sam.query(api.board.get, { code: "test" });
    const loanCommand = { code: "test", expectedPeriod: before.game.currentPeriod,
        expectedTurn: before.game.turn, insightId: loanId };
    const actionsBefore = await t.run(async (context) => await context.db.query("gameActions").collect());

    await expect(sam.mutation(api.trading.activateGovernmentLoan, loanCommand)).rejects.toThrow("not your turn");
    await expect(sam.mutation(api.trading.redeemDebenture, command)).rejects.toThrow("not your turn");
    expect(await sam.query(api.board.get, { code: "test" })).toEqual(before);
    expect(await t.run(async (context) => await context.db.query("gameActions").collect())).toEqual(actionsBefore);
    const dialogs = renderToStaticMarkup(
        <ConvexProvider client={client}>
            <GovernmentLoanModal board={before} insightId={loanId} used={false} />
            <DebentureModal board={before} insightId={insightId} used={false} />
        </ConvexProvider>,
    );

    expect(dialogs).toContain("Wait for your turn to activate.");
    expect(dialogs).toContain("Wait for your turn to sell.");
    expect(dialogs).toContain("disabled=\"\">Activate");
    await t.run(async (context) => await context.db.patch(board.game._id, {
        currentPlayerId: board.player._id, currentUserId: board.user._id,
    }));
    await sam.mutation(api.trading.activateGovernmentLoan, loanCommand);
    const afterLoan = await sam.query(api.board.get, { code: "test" });

    expect(afterLoan.game.currentPlayerId).not.toBe(board.player._id);
    expect(afterLoan.player.cash).toBe(before.player.cash + 10_000);
    await expect(sam.mutation(api.trading.redeemDebenture, {
        ...command, expectedTurn: afterLoan.game.turn,
    })).rejects.toThrow("not your turn");
    expect(await t.run(async (context) => await context.db.get(insightId))).toMatchObject({ resolved: false });
    expect((await sam.query(api.board.get, { code: "test" })).player).toEqual(afterLoan.player);
});
