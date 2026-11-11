import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GameMetrics } from "../src/GameStatus";
import { setup } from "./game-setup";
import { api } from "../convex/_generated/api";

describe("mobile remaining goes", () =>
{
    it("counts the current player's goes across seat rotations and resets each period", async () =>
    {
        const { sam } = await setup();
        const board = await sam.query(api.board.get, { code: "test" });
        for (const period of [0, 1, 4])
        {
            for (let turn = 0; turn < board.players.length * 3; turn++)
            {
                const current = board.players[(period + turn) % board.players.length];
                const used = Math.floor(turn / board.players.length);
                const html = renderToStaticMarkup(
                    <GameMetrics board={{ ...board,
                        game: { ...board.game, currentPeriod: period, turn, currentPlayerId: current._id } }}
                    />,
                );
                const owner = current._id === board.player._id ? "Your" : `${current.name}&#x27;s`;

                expect(html).toContain(`${owner} goes left this period: ${3 - used} of 3, including this turn`);
                expect(html.match(/class="is-used"/g) ?? []).toHaveLength(used);
                expect(html.match(/class="is-current"/g) ?? []).toHaveLength(1);
            }
        }
    });

    it("shows the same Turn and Period trackers for each stock pack", () =>
    {
        const players = [{ _id: "sam", name: "Sam" }];
        for (const pack of ["classic", "frantic", "tech", "crashing"] as const)
        {
            const html = renderToStaticMarkup(
                <GameMetrics board={{ players, game: { pack, currentPlayerId: "sam", turn: 1,
                    currentPeriod: pack === "tech" ? 12 : 1, periodCount: pack === "tech" ? 143 : 5 } }}
                />,
            );

            expect(html).toContain(">Turn</span>");
            expect(html).toContain(">Period</span>");
            expect(html).toContain(pack === "tech" ? "value=\"13\" max=\"144\"" : "value=\"2\" max=\"6\"");
            expect(html).toContain("turn-goes");
        }
    });

    it("advances Tech rounds within a period and rolls over after round twelve", () =>
    {
        for (const [currentPeriod, period, round] of [[0, 1, 1], [1, 1, 2], [11, 1, 12], [12, 2, 1], [143, 12, 12]])
        {
            const html = renderToStaticMarkup(
                <GameMetrics board={{ players: [], game: { pack: "tech", turn: 0, currentPeriod, periodCount: 143 } }} />,
            );

            expect(html).toContain(`aria-valuetext="Period ${period} of 12, Round ${round} of 12"`);
            expect(html).toContain(`value="${currentPeriod + 1}" max="144"`);
            expect(html).toContain(`<small class="game-metric-round">Round ${round} of 12</small>`);
        }
    });
});
