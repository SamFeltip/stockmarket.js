import { expect, it } from "vitest";
import { setup } from "../game-setup";
import { api } from "../../convex/_generated/api";

it("allows only the waiting host to edit the selected NPC in that game", async () =>
{
    const { sam, bob } = await setup(5, 2);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    const board = await sam.query(api.board.get, { code: "test" });
    const npc = board.players[2];

    await expect(
        bob.mutation(api.npc.lobby.setDifficulty, {
            code: "test",
            playerId: npc._id,
            difficulty: "easy",
        }),
    ).rejects.toThrow("Only the lobby host");
    await expect(
        sam.mutation(api.npc.lobby.setDifficulty, {
            code: "test",
            playerId: board.player._id,
            difficulty: "hard",
        }),
    ).rejects.toThrow("Choose an NPC");
    await sam.mutation(api.games.create, { code: "other", periodCount: 5 });
    await expect(
        sam.mutation(api.npc.lobby.setDifficulty, {
            code: "other",
            playerId: npc._id,
            difficulty: "hard",
        }),
    ).rejects.toThrow("Choose an NPC");
    await sam.mutation(api.npc.lobby.setDifficulty, {
        code: "test",
        playerId: npc._id,
        difficulty: "easy",
    });
    const updated = await sam.query(api.board.get, { code: "test" });

    expect(updated.players[2]).toMatchObject({
        name: npc.name,
        profileRoot: npc.profileRoot,
        npcDifficulty: "easy",
    });
    expect(updated.players[3].npcDifficulty).toBe("medium");
});
it("inherits the prior game setting for NPCs from before individual difficulties existed", async () =>
{
    const { t, sam } = await setup(5, 1);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    const board = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { npcDifficulty: "hard" });
        await context.db.patch(board.players[1]._id, { npcDifficulty: undefined });
    });
    expect((await sam.query(api.board.get, { code: "test" })).players[1].npcDifficulty).toBe(
        "hard",
    );
});
