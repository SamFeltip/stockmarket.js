import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

describe("Board-game rules", () =>
{
    it("accepts permitted purchases and sales and rejects larger nonstandard sales atomically", async () =>
    {
        for (const quantity of [1000, 2000, 3000, 4000, 5000, 10_000, 20_000])
        {
            const { sam, bob } = await setup();

            await sam.mutation(api.games.start, { code: "test" });
            await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, stockKey: 8, quantity });
            await bob.mutation(api.trading.play, { code: "test", expectedTurn: 1 });

            if (quantity === 20_000)
            {
                const before = await sam.query(api.board.get, { code: "test" });
                for (const invalid of [-6000, -15_000])
                {
                    await expect(sam.mutation(api.trading.play, {
                        code: "test", expectedTurn: 2, stockKey: 8, quantity: invalid,
                    })).rejects.toThrow("Trade 1000 to 5000");
                }

                const after = await sam.query(api.board.get, { code: "test" });

                expect(after.player).toEqual(before.player);
                expect(after.game).toEqual(before.game);
                expect(after.feed).toEqual(before.feed);
            }

            await sam.mutation(api.trading.play, { code: "test", expectedTurn: 2, stockKey: 8, quantity: -quantity });
            const board = await sam.query(api.board.get, { code: "test" });

            expect(board.player.cash).toBe(60_000);
            expect(board.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(0);
        }
    });
    it("requires two players before dealing or starting", async () =>
    {
        const { sam, bob } = await setup();

        await bob.mutation(api.games.leave, { code: "test" });
        await expect(sam.mutation(api.games.start, { code: "test" })).rejects.toThrow("At least two players");
        const waiting = await sam.query(api.board.get, { code: "test" });

        expect(waiting.game.status).toBe("waiting");
        expect(waiting.insights).toHaveLength(0);
        await bob.mutation(api.games.join, { code: "test" });
        await sam.mutation(api.games.start, { code: "test" });
        expect((await sam.query(api.board.get, { code: "test" })).game.status).toBe("playing");
    });
    it("accepts six through ten periods and rejects invalid lengths on creation and changes", async () =>
    {
        const { sam, bob } = await setup();
        for (const periodCount of [5, 6, 7, 8, 9])
        {
            await sam.mutation(api.games.create, { code: `length-${periodCount}`, periodCount });
            await sam.mutation(api.games.setLength, { code: "test", periodCount });
            expect((await sam.query(api.board.get, { code: "test" })).game.periodCount).toBe(periodCount);
        }

        for (const periodCount of [-1, 0, 4, 5.5, 10])
        {
            await expect(sam.mutation(api.games.create, { code: "invalid", periodCount }))
                .rejects.toThrow("Invalid game length");
            await expect(sam.mutation(api.games.setLength, { code: "test", periodCount }))
                .rejects.toThrow("Invalid game length");
        }

        await expect(bob.mutation(api.games.setLength, { code: "test", periodCount: 5 }))
            .rejects.toThrow("Only the lobby host");
    });

    for (const lastPeriod of [5, 9])
    {
        it(`rotates first and last traders and finishes after index ${lastPeriod}`, async () =>
        {
            const { sam, bob, outsider } = await setup(lastPeriod);
            const clients = [sam, bob, outsider];

            await outsider.mutation(api.games.join, { code: "test" });
            await sam.mutation(api.games.start, { code: "test" });
            const seats = (await sam.query(api.board.get, { code: "test" })).players;
            for (let period = 0; period <= lastPeriod; period++)
            {
                const opened = await sam.query(api.board.get, { code: "test" });

                expect(opened.game.currentPeriod).toBe(period);
                expect(opened.game.currentUserId).toBe(seats[period % 3].userId);
                expect(opened.game.turn).toBe(0);
                expect(opened.insights).toHaveLength(10);

                for (let turn = 0; turn < 9; turn++)
                {
                    const client = clients[(turn + period) % 3];
                    const board = await client.query(api.board.get, { code: "test" });

                    expect(board.game.currentUserId).toBe(board.user._id);
                    await client.mutation(api.trading.play, { code: "test", expectedTurn: turn });
                }

                expect((await sam.query(api.board.get, { code: "test" })).game.status).toBe("closed");
                await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: period });
                expect((await sam.query(api.board.get, { code: "test" })).game.status)
                    .toBe(period === lastPeriod ? "finished" : "playing");
            }
        });
    }

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
