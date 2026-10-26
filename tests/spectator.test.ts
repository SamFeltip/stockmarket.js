import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});

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
        await expect(pat.mutation(api.games.start, { code: "display" })).rejects.toThrow("Only the lobby host");
        const phone = await bob.query(api.board.get, { code: "display" });

        expect(phone.game.hostId).toBe(phone.user._id);
        expect(phone.game.spectatorControlled).toBe(true);
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
                .rejects.toThrow("spectator display");
            await expect(bob.mutation(api.rounds.nextSpectator, { code: "display", expectedPeriod: period }))
                .rejects.toThrow("Only the spectator host");
            await expect(sam.mutation(api.rounds.next, { code: "display", expectedPeriod: period }))
                .rejects.toThrow("spectator display");
            await expect(t.mutation(api.rounds.next, { code: "display", expectedPeriod: period })).rejects.toThrow();
            await sam.mutation(api.rounds.nextSpectator, { code: "display", expectedPeriod: period });
            await expect(sam.mutation(api.rounds.nextSpectator, { code: "display", expectedPeriod: period }))
                .rejects.toThrow("already changed");
            const updated = await t.query(api.tv.board, { code: "display" });

            expect(updated?.game.status).toBe(period === 5 ? "finished" : "playing");
            expect(updated?.players).toHaveLength(4);
            expect(updated?.reveal).toBeNull();
        }
    });
    it("lets the seat-free creator and first phone host manage NPCs with the normal lobby controls", async () =>
    {
        vi.useFakeTimers();
        const { sam, bob, pat, t } = await setup();

        await sam.mutation(api.games.create, { code: "npc-display", periodCount: 5, spectate: true });
        await sam.mutation(api.npc.lobby.add, { code: "npc-display" });
        await bob.mutation(api.games.join, { code: "npc-display" });
        const phone = await bob.query(api.board.get, { code: "npc-display" });

        expect(phone.game.hostId).toBe(phone.user._id);
        await bob.mutation(api.npc.lobby.add, { code: "npc-display", required: true });
        const board = (await sam.query(api.tv.board, { code: "npc-display" }))!;
        const npc = board.players.find((player) => player.kind === "npc")!;

        expect(board.players).toHaveLength(4);
        expect(npc.npcDifficulty).toBe("medium");
        await sam.mutation(api.npc.lobby.setDifficulty, { code: "npc-display", playerId: npc.id, difficulty: "hard" });
        expect((await bob.query(api.board.get, { code: "npc-display" })).players
            .find((player) => player._id === npc.id)?.npcDifficulty).toBe("hard");
        await bob.mutation(api.npc.lobby.remove, { code: "npc-display", playerId: npc.id });
        await sam.mutation(api.npc.lobby.add, { code: "npc-display" });
        await sam.mutation(api.games.setLength, { code: "npc-display", periodCount: 6 });
        await bob.mutation(api.games.setLength, { code: "npc-display", periodCount: 5 });
        await expect(pat.mutation(api.npc.lobby.add, { code: "npc-display" })).rejects.toThrow("Only the lobby host");
        await expect(t.mutation(api.npc.lobby.add, { code: "npc-display" })).rejects.toThrow("Please log in");
        await bob.mutation(api.games.start, { code: "npc-display" });
        expect((await sam.query(api.tv.board, { code: "npc-display" }))?.game.status).toBe("playing");
        await expect(sam.mutation(api.npc.lobby.add, { code: "npc-display" })).rejects.toThrow("while waiting");
    });

    it("supports starting an all-NPC game from the spectator screen without taking a seat", async () =>
    {
        vi.useFakeTimers();
        const { sam } = await setup();

        await sam.mutation(api.games.create, { code: "all-npcs", periodCount: 5, spectate: true });
        await sam.mutation(api.npc.lobby.add, { code: "all-npcs", required: true });
        await sam.mutation(api.games.start, { code: "all-npcs" });
        const board = (await sam.query(api.tv.board, { code: "all-npcs" }))!;

        expect(board.players).toHaveLength(4);
        expect(board.players.every((player) => player.kind === "npc")).toBe(true);
        expect(board.game.status).toBe("playing");
        expect(board.canControl).toBe(true);
    });

    it("preserves existing spectator games and the display owner when phone hosts leave", async () =>
    {
        vi.useFakeTimers();
        const { sam, bob, pat, t } = await setup();

        await sam.mutation(api.games.create, { code: "legacy-display", periodCount: 5, spectate: true });
        await t.run(async (context) =>
        {
            const game = (await context.db.query("games").withIndex("by_code", (q) => q.eq("code", "legacy-display")).unique())!;

            await context.db.patch(game._id, { spectatorHostId: undefined });
        });
        await sam.mutation(api.npc.lobby.add, { code: "legacy-display" });
        await bob.mutation(api.games.join, { code: "legacy-display" });
        await bob.mutation(api.games.leave, { code: "legacy-display" });
        expect((await sam.query(api.tv.board, { code: "legacy-display" }))?.canControl).toBe(true);
        await pat.mutation(api.games.join, { code: "legacy-display" });
        const phone = await pat.query(api.board.get, { code: "legacy-display" });

        expect(phone.game.hostId).toBe(phone.user._id);
        expect(phone.game.spectatorControlled).toBe(true);
        await pat.mutation(api.npc.lobby.add, { code: "legacy-display", required: true });
        await sam.mutation(api.games.start, { code: "legacy-display" });
        expect((await sam.query(api.tv.board, { code: "legacy-display" }))?.game.status).toBe("playing");
    });
    it("restores phone controls for already-populated legacy spectator lobbies without losing the display owner", async () =>
    {
        vi.useFakeTimers();
        const { sam, bob, pat, t } = await setup();

        await sam.mutation(api.games.create, { code: "legacy-joined", periodCount: 5, spectate: true });
        await bob.mutation(api.games.join, { code: "legacy-joined" });
        await pat.mutation(api.games.join, { code: "legacy-joined" });
        const creator = await sam.query(api.users.me);

        await t.run(async (context) =>
        {
            const game = (await context.db.query("games").withIndex("by_code", (q) => q.eq("code", "legacy-joined")).unique())!;

            await context.db.patch(game._id, { spectatorHostId: undefined, hostId: creator._id });
        });
        const phone = await bob.query(api.board.get, { code: "legacy-joined" });

        expect(phone.game.hostId).toBe(phone.user._id);
        await bob.mutation(api.npc.lobby.add, { code: "legacy-joined", required: true });
        await sam.mutation(api.games.join, { code: "legacy-joined" });
        expect((await sam.query(api.tv.board, { code: "legacy-joined" }))?.canControl).toBe(true);
        expect((await bob.query(api.board.get, { code: "legacy-joined" })).game.spectatorControlled).toBe(true);
        await bob.mutation(api.games.start, { code: "legacy-joined" });
        await expect(sam.mutation(api.rounds.next, { code: "legacy-joined", expectedPeriod: 0 }))
            .rejects.toThrow("spectator display");
    });
});
