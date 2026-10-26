import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

describe("Web spectator host", () =>
{
    it("creates without a seat, retains hosting, and controls every period through completion", async () =>
    {
        const { t, sam, bob, pat, lee, outsider } = await setup();
        const players = [bob, pat, lee, outsider];

        await sam.mutation(api.games.create, { code: "DISPLAY", periodCount: 5, spectate: true });
        const empty = await sam.query(api.tv.board, { code: "display" });

        expect(empty?.players).toEqual([]);
        expect(empty?.canControl).toBe(true);
        expect((await t.query(api.tv.board, { code: "display" }))?.canControl).toBe(false);
        await expect(sam.mutation(api.games.start, { code: "display" })).rejects.toThrow("four players");

        await bob.mutation(api.games.join, { code: "display" });
        await bob.mutation(api.games.leave, { code: "display" });
        expect((await sam.query(api.tv.board, { code: "display" }))?.canControl).toBe(true);

        for (const player of players)
        {
            await player.mutation(api.games.join, { code: "display" });
        }

        const ready = await sam.query(api.tv.board, { code: "display" });

        expect(ready?.players).toHaveLength(4);
        expect(ready?.canControl).toBe(true);
        expect((await bob.query(api.tv.board, { code: "display" }))?.canControl).toBe(false);
        await expect(bob.mutation(api.games.start, { code: "display" })).rejects.toThrow("Only the lobby host");
        await expect(t.mutation(api.games.start, { code: "display" })).rejects.toThrow();
        await expect(sam.query(api.board.get, { code: "display" })).rejects.toThrow();
        await sam.mutation(api.games.start, { code: "display" });
        const playing = await t.query(api.tv.board, { code: "display" });

        expect(playing?.reveal).toBeNull();
        expect(JSON.stringify(playing)).not.toMatch(/"insights"|"description"|"userId"|"hostId"/);

        for (let period = 0; period < 6; period++)
        {
            for (let turn = 0; turn < 12; turn++)
            {
                await players[(period + turn) % 4].mutation(api.trading.play, {
                    code: "display", expectedPeriod: period, expectedTurn: turn,
                });
            }

            const closed = await t.query(api.tv.board, { code: "display" });

            expect(closed?.reveal?.insights.length).toBeGreaterThan(0);
            await expect(bob.mutation(api.rounds.next, { code: "display", expectedPeriod: period }))
                .rejects.toThrow("Only the lobby host");
            await expect(t.mutation(api.rounds.next, { code: "display", expectedPeriod: period })).rejects.toThrow();
            await sam.mutation(api.rounds.next, { code: "display", expectedPeriod: period });
            await expect(sam.mutation(api.rounds.next, { code: "display", expectedPeriod: period }))
                .rejects.toThrow("already changed");
            const updated = await t.query(api.tv.board, { code: "display" });

            expect(updated?.game.status).toBe(period === 5 ? "finished" : "playing");
            expect(updated?.players).toHaveLength(4);
            expect(updated?.reveal).toBeNull();
        }
    });
});
