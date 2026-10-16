import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

describe("Board-game rules", () =>
{
    it("starts both host and guest with £60,000", async () =>
    {
        const { sam, bob } = await setup();

        expect((await sam.query(api.board.get, { code: "test" })).player.cash).toBe(60_000);
        expect((await bob.query(api.board.get, { code: "test" })).player.cash).toBe(60_000);
    });
    it("shares a 200,000-share supply across players and returns sold shares to it", async () =>
    {
        const { t, sam, bob } = await setup();

        await t.run(async (context) =>
        {
            for (const player of await context.db.query("players").collect())
            {
                await context.db.patch(player._id, { cash: 1_000_000 });
            }
        });
        await sam.mutation(api.games.start, { code: "test" });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, stockKey: 8, quantity: 110_000 });
        await bob.mutation(api.trading.play, { code: "test", expectedTurn: 1, stockKey: 8, quantity: 90_000 });
        await expect(sam.mutation(api.trading.play, {
            code: "test", expectedTurn: 2, stockKey: 8, quantity: 1000,
        })).rejects.toThrow("Not enough shares available");
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 2, stockKey: 8, quantity: -10_000 });
        await bob.mutation(api.trading.play, { code: "test", expectedTurn: 3, stockKey: 8, quantity: 10_000 });
        const board = await sam.query(api.board.get, { code: "test" });
        const total = board.players.reduce((sum, player) => sum
          + (player.holdings.find((holding) => holding.stockKey === 8)?.quantity ?? 0), 0);

        expect(total).toBe(200_000);
        expect(board.player.cash).toBe(750_000);
    });
});
