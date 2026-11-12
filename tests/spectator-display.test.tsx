import { describe, expect, it, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";
import { SpectatorScreen } from "../src/spectator/SpectatorPage";
import { RoundPresentation } from "../src/spectator/RoundPresentation";
import { websiteBoard } from "../src/spectator/presentation";
import { Dashboard } from "../src/spectator/Dashboard";
import { stockLogo } from "../src/spectator/assets";
import type { Board } from "../src/spectator/types";

const client = new ConvexReactClient("https://spectator-ui-test.invalid");
const render = (board: Board) => renderToStaticMarkup(
    <ConvexProvider client={client}><MemoryRouter><SpectatorScreen board={board} /></MemoryRouter></ConvexProvider>,
);

afterEach(() =>
{
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function fixture()
{
    vi.stubGlobal("location", { origin: "https://stockmarket.samfelton.com" });
    const game = await setup();
    const board = await game.sam.query(api.tv.board, { code: "test" });

    return { ...game, board: board! };
}

describe("TV spectator display parity", () =>
{
    it("shows the same empty-lobby prompt, roster, length, QR panel and launch control", async () =>
    {
        const { board } = await fixture();
        const populated = render(board);
        for (const text of ["Lobby code:", "Waiting for players to join (4 / 6)", "Game length", "<strong>6</strong><span>periods</span>",
            "Launch Game", "Minimum 4 players required", "Scan the QR code", "Stockmarket!"])
        {
            expect(populated).toContain(text);
        }

        for (const player of board.players)
        {
            expect(populated).toContain(player.name);
            expect(populated).toContain(player.profileRoot);
        }

        const empty = render({ ...board, players: [] });

        expect(empty).toContain("Scan to join the game");
        expect(empty).toContain("Add NPC");
        expect(empty).toContain("disabled=\"\">Launch Game");

        const watching = render({ ...board, canControl: false });

        expect(watching).toContain("6 periods");
        expect(watching).not.toContain(">Launch Game</button>");
    });

    it("shows all stock, portfolio, turn, QR, history and trade panels while keeping cards private", async () =>
    {
        const { sam, board } = await fixture();

        await sam.mutation(api.games.start, { code: "test" });
        const playing = (await sam.query(api.tv.board, { code: "test" }))!;
        const html = render(playing);
        for (const text of ["Spectator view", "Turn", "Period progress", "Stocks", "Player portfolios",
            "Cash", "Net worth", "Total net worth", "Play style", "Current player", "Feed", "Join on your phone",
            "History appears after each period"])
        {
            expect(html).toContain(text);
        }

        for (const stock of board.stocks)
        {
            expect(html).toContain(stock.imagePath);
            expect(html).toContain(stock.name.replaceAll("&", "&amp;"));
        }

        const header = html.match(/<header.*?<\/header>/)?.[0];
        const current = playing.players.find((player) => player.id === playing.game.currentPlayerId);

        expect(header).toContain(`<p>Current player</p><strong>${current?.name}</strong>`);
        expect(html).toContain("<h3>Total net worth</h3><strong>£240,000</strong><p>£0 in shares</p>");
        expect(html).toContain("<h3>Play style</h3><strong>Classic</strong>");
        expect(html).not.toContain("Combined wealth");
        expect(html).not.toContain("Latest purchase");
        expect(html).not.toContain("Private insights stay on your phone.");
        expect(html).not.toContain("End of round");
        expect(websiteBoard(playing).insights).toEqual([]);
        expect(websiteBoard(playing).players).toHaveLength(board.players.length);
    });

    it("uses the Frantic volatility order in cards, portfolio columns and matching holdings", async () =>
    {
        const { t, sam } = await fixture();

        await sam.mutation(api.games.setPack, { code: "test", pack: "frantic" });
        const board = (await t.query(api.tv.board, { code: "test" }))!;
        const withHoldings = { ...board, players: [{ ...board.players[0],
            holdings: board.stocks.map((stock) => ({ stockKey: stock.key, quantity: stock.key })).toReversed(),
        }] };
        const html = renderToStaticMarkup(<Dashboard board={withHoldings} phoneUrl="https://stockmarket.samfelton.com" />);
        const names = ["UB", "Legal &amp; General", "Thames", "Saatchi &amp; Saatchi", "Trusthouse Forte", "Natwest"];

        expect([...html.matchAll(/<h3>(.*?)<\/h3>/g)].slice(0, 6).map((match) => match[1])).toEqual(names);
        const header = html.match(/<thead>(.*?)<\/thead>/)![1];
        const body = html.match(/<tbody>(.*?)<\/tbody>/)![1];

        expect([...header.matchAll(/alt="(.*?)"/g)].map((match) => match[1])).toEqual(names);
        expect([...body.matchAll(/<td>(\d+)<\/td>/g)].map((match) => Number(match[1])))
            .toEqual([8, 9, 10, 11, 7, 12]);
    });

    it("shows round results and lets spectators advance or finish once holds are resolved", async () =>
    {
        const { sam, clients } = await fixture();

        await sam.mutation(api.games.start, { code: "test" });

        for (let turn = 0; turn < 12; turn++)
        {
            await clients[turn % 4].mutation(api.trading.play, { code: "test", expectedPeriod: 0, expectedTurn: turn });
        }

        const closed = (await sam.query(api.tv.board, { code: "test" }))!;
        const summary = (snapshot: Board) => renderToStaticMarkup(
            <ConvexProvider client={client}>
                <RoundPresentation
                    snapshot={{ ...snapshot, reveal: snapshot.reveal ? { ...snapshot.reveal,
                        insights: snapshot.reveal.insights.map((card) => card.chanceKind === "hold"
                            ? { ...card, used: true } : card) } : null }}
                    onNext={() => undefined}
                    busy={false}
                    error=""
                    onBack={() => undefined}
                    overview
                />
            </ConvexProvider>,
        );
        const waiting = render(closed);

        expect(waiting).toContain("Revealing insights shortly…");
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
        const reveal = render(closed);

        expect(reveal).toContain("End of round");
        expect(reveal).not.toContain("Stock Values:");
        expect(reveal).toContain("round-reveal-chart");
        expect(reveal).toContain("Net Worth");
        expect(reveal).toContain("round-player-holdings");
        expect(summary(closed)).toContain("Round overview");
        expect(summary(closed)).toContain("Next Period");
        expect(summary({ ...closed, canControl: false })).toContain("Next Period");
        const publicReveal = closed.reveal!;
        const pending = { ...closed, reveal: { ...publicReveal,
            stocks: [...publicReveal.stocks, { key: 999, name: "Hold Stock Price", display: false, variation: 0,
                imagePath: "", secondaryImagePath: "" }],
            insights: [...publicReveal.insights, { ...publicReveal.insights[0], stockKey: 999, resolved: false }],
        } };

        expect(summary(pending)).toContain("Waiting for players to resolve their hold-stock insights.");
        expect(summary(pending)).toContain("disabled=\"\">Next Period");
        expect(summary({ ...closed, canControl: false, game: { ...closed.game, tvControlled: true } }))
            .toContain("Next Period");
        const finalRound = { ...closed, canControl: false,
            game: { ...closed.game, currentPeriod: closed.game.periodCount } };

        expect(summary(finalRound))
            .toContain("Finish Game");
    });

    it("shows final rankings, selectable portfolios and recorded price histories", async () =>
    {
        const { board } = await fixture();
        const finished = { ...board, game: { ...board.game, status: "finished" as const } };
        const html = render(finished);
        for (const text of ["tv-results", "Game finished", "wins!", "Final rankings", "Cash £", "Stocks worth £",
            "Final stock price histories", "Starting value", "Max value", "Min value"])
        {
            expect(html).toContain(text);
        }

        for (const stock of board.stocks)
        {
            expect(html).toContain(stock.imagePath);
        }

        expect(websiteBoard(finished).players.map((player) => player.ranking)).toEqual([1, 2, 3, 4]);
        expect(stockLogo(7)).toBe("/static/imgs/stocks/thf.png");
        expect(stockLogo(7, "/custom.svg")).toBe("/custom.svg");
    });
});
