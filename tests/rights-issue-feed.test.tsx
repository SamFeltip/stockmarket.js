import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { api, internal } from "../convex/_generated/api";
import { setup } from "./game-setup";
import { chanceStockKey } from "../shared/chance-cards";
import { RightsIssueSpectatorDesktop } from "../src/RightsIssueSpectatorDesktop";
import { FeedMessage } from "../src/FeedMessage";

it("publishes Rights Issue activation, purchases, skips and resumption to the spectator feed", async () =>
{
    vi.useFakeTimers();

    try
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const board = await sam.query(api.board.get, { code: "test" });
        const insightId = await t.run(async (context) =>
        {
            await context.db.patch(board.game._id, { currentPlayerId: board.player._id,
                currentUserId: board.user._id, turn: 0 });

            for (const player of board.players)
            {
                await context.db.patch(player._id, { cash: 10_000, holdings: [{ stockKey: 8, quantity: 2000 }] });
            }

            return context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
                period: board.game.currentPeriod, stockKey: chanceStockKey, chanceKind: "rights",
                value: 0, resolved: false, description: "Rights Issue" });
        });

        await sam.mutation(api.rightsIssue.activate, { code: "test", insightId, stockKey: 8,
            expectedPeriod: board.game.currentPeriod, expectedTurn: 0 });
        const started = await sam.query(api.board.get, { code: "test" });
        const html = renderToStaticMarkup(<RightsIssueSpectatorDesktop board={started} />);

        expect(html).toContain("Gameplay paused during Rights Issue");
        expect(html).toContain("Game feed");
        expect(html).toContain("<h3>Play style</h3><strong>Classic</strong>");
        expect(html).toContain("is deciding how much");
        expect(html).toContain("opened a Rights Issue");
        await sam.mutation(api.rightsIssue.decide, { code: "test", insightId, expectedIndex: 0, quantity: 1000 });

        for (let index = 1; index < started.game.rightsIssue!.offers.length; index++)
        {
            await sam.mutation(api.rightsIssue.skip, { code: "test", insightId, expectedIndex: index });
        }

        const publicBoard = (await sam.query(api.tv.board, { code: "test" }))!;
        const purchase = publicBoard.feed.find((item) => item.message.includes("shares in the Rights Issue"))!;

        expect(purchase).toMatchObject({ stockKey: 8, quantity: 1000 });
        expect(publicBoard.feed.some((item) => item.message.includes("skipped the"))).toBe(true);
        expect(renderToStaticMarkup(
            <FeedMessage
                item={{ ...purchase, _id: purchase.id, _creationTime: purchase.at }}
                stocks={started.stocks}
            />,
        )).toContain("Rights Issue · £1 per share");
        await sam.mutation(internal.rightsIssue.finish, { gameId: board.game._id, insightId });
        expect((await sam.query(api.tv.board, { code: "test" }))!.feed.some((item) =>
            item.message === "Rights Issue complete. Trading resumes.")).toBe(true);
    }
    finally
    {
        vi.useRealTimers();
    }
});
