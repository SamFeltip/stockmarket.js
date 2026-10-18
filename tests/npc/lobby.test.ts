import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup } from "../game-setup";

beforeEach(() =>
{
    vi.useFakeTimers();
});
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});
describe("NPC lobby contract", () =>
{
    for (let humans = 1; humans <= 6; humans++)
    {
        it(`supports ${humans} humans and every remaining NPC seat`, async () =>
        {
            const { t, sam, clients } = await setup(5, Math.min(4, humans));
            for (let index = 4; index < humans; index++)
            {
                const userId = await t.run(async (context) =>
                    context.db.insert("users", { name: `human${index}`, profileRoot: "" }),
                );

                await t
                    .withIdentity({ subject: `${userId}|session` })
                    .mutation(api.games.join, { code: "test" });
            }

            if (humans < 4)
            {
                await expect(sam.mutation(api.games.start, { code: "test" })).rejects.toThrow(
                    "At least four",
                );
            }

            if (humans > 1)
            {
                await expect(
                    clients[1].mutation(api.npc.lobby.add, { code: "test" }),
                ).rejects.toThrow("Only the lobby host");
            }

            await sam.mutation(api.npc.lobby.setDifficulty, { code: "test", difficulty: "hard" });
            await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
            let board = await sam.query(api.board.get, { code: "test" });

            expect(board.players).toHaveLength(Math.max(4, humans));

            while (board.players.length < 6)
            {
                await sam.mutation(api.npc.lobby.add, { code: "test" });
                board = await sam.query(api.board.get, { code: "test" });
            }

            const npcs = board.players.filter((seat) => seat.kind === "npc");

            expect(new Set(npcs.map((seat) => seat.name)).size).toBe(6 - humans);
            expect(
                npcs.every((seat) => !seat.userId && seat.profileRoot.endsWith("profile.png")),
            ).toBe(true);
            await expect(sam.mutation(api.npc.lobby.add, { code: "test" })).rejects.toThrow("full");
            await sam.mutation(api.games.start, { code: "test" });
            expect((await sam.query(api.board.get, { code: "test" })).game.npcDifficulty).toBe(
                "hard",
            );
            await expect(
                sam.mutation(api.npc.lobby.setDifficulty, { code: "test", difficulty: "easy" }),
            ).rejects.toThrow("while waiting");
        });
    }

    it("keeps identities stable and returns removed personalities to the end of the saved queue", async () =>
    {
        const { sam, t } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        const initial = await sam.query(api.board.get, { code: "test" });

        await sam.mutation(api.npc.lobby.setDifficulty, { code: "test", difficulty: "easy" });
        expect((await sam.query(api.board.get, { code: "test" })).players.map((seat) => ({ id: seat._id, name: seat.name })))
            .toEqual(initial.players.map((seat) => ({ id: seat._id, name: seat.name })));
        const removed = initial.players[1];

        await sam.mutation(api.npc.lobby.remove, { code: "test", playerId: removed._id });
        const queue = await t.run(
            async (context) => (await context.db.query("npcGameConfigs").unique())!.queue,
        );

        expect(queue.at(-1)).toBe(
            removed.controller.kind === "npc" ? removed.controller.personality : "",
        );
        await sam.mutation(api.npc.lobby.add, { code: "test" });
        const next = await sam.query(api.board.get, { code: "test" });

        expect(next.players.some((seat) => seat.name === removed.name)).toBe(false);
        expect(next.players.find((seat) => seat._id === initial.players[2]._id)).toMatchObject({
            name: initial.players[2].name,
            profileRoot: initial.players[2].profileRoot,
            controller: initial.players[2].controller,
        });
    });
    it("transfers hosting to a human and deletes the waiting lobby when the last human leaves", async () =>
    {
        const { t, sam, bob } = await setup(5, 2);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await sam.mutation(api.games.leave, { code: "test" });
        const board = await bob.query(api.board.get, { code: "test" });

        expect(board.game.hostId).toBe(board.user._id);
        await bob.mutation(api.games.leave, { code: "test" });
        await t.run(async (context) =>
        {
            for (const table of [
                "games",
                "players",
                "npcGameConfigs",
                "npcStates",
                "npcTurns",
            ] as const)
            {
                expect(await context.db.query(table).collect()).toHaveLength(0);
            }
        });
    });
    it("never displaces an NPC when a human joins a full lobby", async () =>
    {
        const { sam, outsider } = await setup();

        await sam.mutation(api.npc.lobby.add, { code: "test" });
        await sam.mutation(api.npc.lobby.add, { code: "test" });
        await expect(outsider.mutation(api.games.join, { code: "test" })).rejects.toThrow("full");
    });
});
