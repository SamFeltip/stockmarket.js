import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup } from "../game-setup";
import { roster } from "../../../stockmarket-shared/src/npc-catalog";

it("adds repeated personalities as independent seats with independent state", async () =>
{
    const { t, sam } = await setup(5, 1);
    for (let index = 0; index < 5; index++)
    {
        await sam.mutation(api.npc.lobby.add, { code: "test", personality: "felix" });
    }

    const board = await sam.query(api.board.get, { code: "test" });
    const npcs = board.players.filter((player) => player.kind === "npc");

    expect(npcs).toHaveLength(5);
    expect(new Set(npcs.map((player) => player._id)).size).toBe(5);
    expect(npcs.every((player) => player.npcPersonality === "felix" && player.name === "Felix Fox")).toBe(true);
    const states = await t.run(async (context) => context.db.query("npcStates").collect());

    expect(new Set(states.map((state) => state.playerId)).size).toBe(5);
    await sam.mutation(api.npc.lobby.remove, { code: "test", playerId: npcs[0]._id });
    expect((await sam.query(api.board.get, { code: "test" })).players.filter((player) => player.kind === "npc"))
        .toHaveLength(4);
    expect(await t.run(async (context) => context.db.query("npcStates").collect())).toHaveLength(4);
    await sam.mutation(api.npc.lobby.add, { code: "test", personality: "felix" });
    await expect(sam.mutation(api.npc.lobby.add, { code: "test", personality: "felix" })).rejects.toThrow("full");
});

it("changes one NPC's personality, portrait and name while retaining its seat and difficulty", async () =>
{
    const { sam } = await setup(5, 2);

    await sam.mutation(api.npc.lobby.add, { code: "test", personality: "ada" });
    await sam.mutation(api.npc.lobby.add, { code: "test", personality: "felix" });
    const before = await sam.query(api.board.get, { code: "test" });
    const npc = before.players[2];
    const other = before.players[3];

    await sam.mutation(api.npc.lobby.setDifficulty, { code: "test", playerId: npc._id, difficulty: "hard" });
    await sam.mutation(api.npc.lobby.setPersonality, { code: "test", playerId: npc._id, personality: "felix" });
    const after = await sam.query(api.board.get, { code: "test" });
    const felix = roster.find((entry) => entry.id === "felix")!;

    expect(after.players[2]).toMatchObject({ _id: npc._id, name: felix.name, profileRoot: felix.portrait,
        npcPersonality: "felix", npcDifficulty: "hard", cash: npc.cash, holdings: npc.holdings });
    expect(after.players[3]).toEqual(other);
    const display = await sam.query(api.tv.board, { code: "test" });

    expect(display?.players[2]).toMatchObject({ id: npc._id, npcPersonality: "felix", name: felix.name });
    await sam.mutation(api.games.start, { code: "test" });
    await expect(sam.mutation(api.npc.lobby.setPersonality, { code: "test", playerId: npc._id,
        personality: "ada" })).rejects.toThrow("while waiting");
});

it("restricts personality changes to the host and NPCs within that waiting lobby", async () =>
{
    const { sam, bob } = await setup(5, 2);

    await sam.mutation(api.npc.lobby.add, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });
    const command = { code: "test", playerId: board.players[2]._id, personality: "ada" as const };

    await expect(bob.mutation(api.npc.lobby.setPersonality, command)).rejects.toThrow("Only the lobby host");
    await expect(sam.mutation(api.npc.lobby.setPersonality, { ...command, playerId: board.player._id }))
        .rejects.toThrow("Choose an NPC");
    await sam.mutation(api.games.create, { code: "other", periodCount: 5 });
    await expect(sam.mutation(api.npc.lobby.setPersonality, { ...command, code: "other" }))
        .rejects.toThrow("Choose an NPC");
});

it("fills a spectator-hosted lobby beyond the five unique personalities", async () =>
{
    const { sam } = await setup(5, 1);

    await sam.mutation(api.games.create, { code: "display", periodCount: 5, spectate: true });

    for (let index = 0; index < 6; index++)
    {
        await sam.mutation(api.npc.lobby.add, { code: "display" });
    }

    const board = await sam.query(api.tv.board, { code: "display" });

    expect(board?.players).toHaveLength(6);
    expect(board?.players.every((player) => player.kind === "npc" && player.npcPersonality)).toBe(true);
});
