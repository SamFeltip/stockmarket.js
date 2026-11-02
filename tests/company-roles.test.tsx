import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { companyRoles, withRoleBonuses } from "../shared/company-roles";
import { api } from "../convex/_generated/api";
import { previewRound } from "../src/round-preview";
import { Investors } from "../src/Investors";
import { RoundReveal } from "../src/RoundReveal";
import { StockRoleFooter } from "../src/StockRoleFooter";
import { Insights } from "../src/shared";
import { websiteBoard } from "../src/spectator/presentation";
import { RoundPresentation } from "../src/spectator/RoundPresentation";
import { Dashboard } from "../src/spectator/Dashboard";
import { RoundOverview } from "../src/RoundOverview";
import { setup } from "./game-setup";

const seat = (_id: string, quantity: number, order = 0) => ({ _id,
    holdings: [{ stockKey: 8, quantity }], chairmanSince: [{ stockKey: 8, order }] });
const card = (_id: string, playerId: string, value: number, stockKey = 8) => ({
    _id, playerId, value, stockKey, description: "Price movement", resolved: false,
});
const stocks = [{ key: 8, display: true }, { key: 13, display: false }];

describe("company roles", () =>
{
    it("awards threshold roles, keeps the earliest chairman and relinquishes roles below their thresholds", () =>
    {
        expect(companyRoles([seat("a", 49_000), seat("b", 50_000)], 8))
            .toEqual([{ playerId: "b", role: "director" }]);
        expect(companyRoles([seat("a", 100_000, 5), seat("b", 100_000, 1)], 8))
            .toEqual([{ playerId: "a", role: "director" }, { playerId: "b", role: "chairman" }]);
        expect(companyRoles([seat("a", 100_000, 5), seat("b", 99_000, 1)], 8))
            .toEqual([{ playerId: "a", role: "chairman" }, { playerId: "b", role: "director" }]);
        expect(companyRoles([seat("a", 49_000)], 8)).toEqual([]);
    });

    it("cancels only the worst permitted negative once per company, with chairman precedence", () =>
    {
        const cards = [card("a", "a", -1), card("b", "b", -1.5), card("c", "c", -3),
            card("d", "a", 4), card("special", "a", -0.5, 13)];
        const directors = withRoleBonuses(cards, [seat("a", 50_000), seat("b", 50_000)], stocks);

        expect(directors.slice(cards.length)).toEqual([expect.objectContaining({ playerId: "b",
            value: 1.5, bonusRole: "director", removedInsightId: "b" })]);
        const chairman = withRoleBonuses(cards, [seat("a", 100_000), seat("b", 50_000)], stocks);

        expect(chairman.slice(cards.length)).toEqual([expect.objectContaining({ playerId: "a",
            value: 3, bonusRole: "chairman", removedInsightId: "c" })]);
        expect(withRoleBonuses([card("positive", "a", 2), card("zero", "a", 0)], [seat("a", 100_000)], stocks))
            .toHaveLength(2);
    });

    it("tracks real trade qualification and requalification, exposes bonuses only after close, and settles like the preview", async () =>
    {
        const { t, sam, bob, pat, lee } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const initial = await sam.query(api.board.get, { code: "test" });

        await t.run(async (context) =>
        {
            for (const player of initial.players)
            {
                await context.db.patch(player._id, { cash: 1_000_000 });
            }
        });
        const play = (client: typeof sam, turn: number, quantity?: number) => client.mutation(api.trading.play,
            { code: "test", expectedTurn: turn, expectedPeriod: 0, ...(quantity ? { stockKey: 8, quantity } : {}) });

        await play(sam, 0, 100_000);
        await play(bob, 1, 100_000);
        let board = await sam.query(api.board.get, { code: "test" });

        expect(board.players[0].roles).toContainEqual({ stockKey: 8, role: "chairman" });
        expect(board.players[1].roles).toContainEqual({ stockKey: 8, role: "director" });
        expect(board.insights.some((insight) => insight.bonusRole)).toBe(false);
        expect((await sam.query(api.tv.board, { code: "test" }))?.reveal).toBeNull();
        await play(pat, 2);
        await play(lee, 3);
        await play(sam, 4, -10_000);
        await play(bob, 5);
        await play(pat, 6);
        await play(lee, 7);
        await play(sam, 8, 10_000);
        board = await sam.query(api.board.get, { code: "test" });
        expect(board.players[1].roles).toContainEqual({ stockKey: 8, role: "chairman" });
        await play(bob, 9);
        await play(pat, 10);
        await play(lee, 11);
        await t.run(async (context) =>
        {
            const insights = await context.db.query("playerInsights").collect();
            for (const insight of insights)
            {
                await context.db.patch(insight._id, { value: 0 });
            }

            await context.db.patch(insights[0]._id, { stockKey: 8, value: -1.5 });
        });
        board = await sam.query(api.board.get, { code: "test" });
        const bonus = board.insights.find((insight) => insight.bonusRole)!;
        const preview = previewRound(board, board.insights, [8]);
        const tv = await sam.query(api.tv.board, { code: "test" });

        expect(bonus).toMatchObject({ bonusRole: "chairman", playerId: board.players[1]._id, value: 1.5 });
        expect(bonus).toMatchObject(tv!.reveal!.insights.find((insight) => insight.bonusRole)!);
        const investors = renderToStaticMarkup(<Investors players={board.players} stockKey={8} />);
        const reveal = renderToStaticMarkup(
            <RoundReveal
                board={board}
                preview={preview}
                stock={board.stocks.find((stock) => stock.key === 8)!}
                insights={board.insights.filter((insight) => insight.stockKey === 8)}
                index={board.insights.filter((insight) => insight.stockKey === 8).length - 1}
            />,
        );
        const overview = renderToStaticMarkup(<RoundOverview before={board} after={preview} />);

        expect(investors).toContain("chairman.svg");
        expect(investors).toContain("director.svg");
        expect(reveal).toContain("+£1.50");
        expect(reveal).toContain("chairman influence");
        expect(overview).toContain("chairman influence");
        const footer = renderToStaticMarkup(
            <StockRoleFooter
                board={board}
                stock={board.stocks.find((stock) => stock.key === 8)!}
            />,
        );

        expect(footer).toContain("aria-label=\"UB company roles\"");
        expect(footer).toContain("Chairman");
        expect(footer).toContain("Director");
        expect(footer.match(/influence/g)).toHaveLength(1);
        expect(footer).not.toContain("director bonus");
        const spectator = renderToStaticMarkup(
            <RoundPresentation
                snapshot={{ ...tv!, feed: [] }}
                overview
                onNext={vi.fn()}
                onBack={vi.fn()}
                busy={false}
                error=""
            />,
        );
        const spectatorFooter = renderToStaticMarkup(
            <StockRoleFooter
                board={websiteBoard(tv!)}
                stock={board.stocks.find((stock) => stock.key === 8)!}
            />,
        );

        expect(spectatorFooter).toBe(footer);
        expect(spectator).toContain("aria-label=\"UB company roles\"");
        expect(spectator).toContain("chairman influence");
        const dashboard = renderToStaticMarkup(<Dashboard board={tv!} phoneUrl="https://example.com" />);

        expect(dashboard).toContain("alt=\"Chairman of UB\"");
        expect(dashboard).toContain("alt=\"Director of UB\"");
        const cards = renderToStaticMarkup(
            <Insights
                stocks={board.stocks}
                insights={[
                    { ...board.insights[0], stockKey: 8, value: -1.5, description: "UB Insight -1.5" },
                    { ...board.insights[1], stockKey: 8, value: 0, description: "UB Insight 0" },
                ]}
            />,
        );

        expect(cards).toContain("insight-stock-label");
        expect(cards).toContain("UB</span>");
        expect(cards).toContain("£-1.50");
        expect(cards).toContain("text-danger");
        expect(cards).toContain("£0.00");
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const settled = await sam.query(api.board.get, { code: "test" });

        expect(settled.game.prices).toEqual(preview.game.prices);
        expect(settled.players.map((player) => player.netWorth))
            .toEqual(preview.players.map((player) => player.netWorth));
        expect(settled.players[1].roles).toContainEqual({ stockKey: 8, role: "chairman" });
        await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 })).rejects.toThrow();
    });
});
