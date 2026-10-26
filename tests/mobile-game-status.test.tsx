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
});
