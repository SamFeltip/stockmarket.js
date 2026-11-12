import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { actionAnimationMs, insightRevealMs, revealDelay, revealPauseMs } from "../shared/presentation";
import { cashStock } from "../shared/chance-cards";
import { RoundWealth } from "../src/RoundWealth";
import { setup } from "./game-setup";
import { api } from "../convex/_generated/api";

describe("round presentation", () =>
{
    it("reveals Tech insight cards every quarter second and keeps the Classic interval", () =>
    {
        expect(insightRevealMs("classic")).toBe(2500);
        expect(insightRevealMs("tech")).toBe(250);
    });

    it("waits through the final action animation and a pause, without delaying old rounds", () =>
    {
        expect(revealDelay(1000, 1000)).toBe(actionAnimationMs + revealPauseMs);
        expect(revealDelay(1000, 4500)).toBe(revealPauseMs);
        expect(revealDelay(1000, 5000)).toBe(0);
        expect(revealDelay(undefined, 1000)).toBe(0);
    });
    it("shows each player's holdings for the currently revealed stock, including zero shares", async () =>
    {
        const { sam } = await setup();
        const board = await sam.query(api.board.get, { code: "test" });
        const stock = board.stocks.find((item) => item.display)!;
        const players = board.players.map((player, index) => ({ ...player,
            holdings: [{ stockKey: stock.key, quantity: index === 0 ? 2000 : 0 }] }));
        const html = renderToStaticMarkup(<RoundWealth players={players} stock={stock} />);

        const text = html.replaceAll(/<[^>]+>/g, "");

        expect(text).toContain(`2,000 ${stock.name} shares`);
        expect(text).toContain(`0 ${stock.name} shares`);
        expect(html.match(/class="round-wealth-card /g)).toHaveLength(players.length);
        expect(renderToStaticMarkup(<RoundWealth players={players} stock={{ ...stock, display: false }} />))
            .not.toContain("round-player-holdings");
        const cashHtml = renderToStaticMarkup(<RoundWealth players={players} stock={cashStock} />);

        expect(cashHtml).toContain("class=\"round-player-holdings round-player-cash\"");
        expect(cashHtml).toContain("Cash <span class=\"net-worth-number\"");
        expect(cashHtml).toContain("£60,000");
        expect(cashHtml).not.toContain(`${stock.name} shares`);
    });
});
