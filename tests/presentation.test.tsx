import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { actionAnimationMs, revealDelay, revealPauseMs } from "../shared/presentation";
import { RoundWealth } from "../src/RoundWealth";
import { setup } from "./game-setup";
import { api } from "../convex/_generated/api";

describe("round presentation", () =>
{
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

        expect(html).toContain(`2,000 ${stock.name} shares`);
        expect(html).toContain(`0 ${stock.name} shares`);
        expect(renderToStaticMarkup(<RoundWealth players={players} stock={{ ...stock, display: false }} />))
            .not.toContain("round-player-holdings");
    });
});
