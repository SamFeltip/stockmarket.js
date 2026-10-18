import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Waiting } from "../../src/GamePage";
import { Portfolio } from "../../src/Portfolio";
import { NpcTurnStatus } from "../../src/npc/NpcTurnStatus";
import { api } from "../../convex/_generated/api";
import { setup } from "../game-setup";

it("renders the manual Add NPC tile, per-NPC controls and launch tooltip without the removed copy", async () =>
{
    const { sam, bob } = await setup(5, 2);
    const client = new ConvexReactClient("https://npc-ui-test.invalid");
    const render = (board: Awaited<ReturnType<typeof sam.query<typeof api.board.get>>>) =>
        renderToStaticMarkup(
            <ConvexProvider client={client}>
                <MemoryRouter>
                    <Waiting board={board} />
                </MemoryRouter>
            </ConvexProvider>,
        );
    const empty = render(await sam.query(api.board.get, { code: "test" }));

    expect(empty).toContain("npc-add-tile");
    expect(empty).toContain("data-bs-title=\"minimum 4 players required\"");
    expect(empty).not.toContain("Add required NPCs");
    expect(empty).not.toContain("Difficulty improves");
    expect(empty).not.toContain("Add 2 NPCs or invite");
    expect(empty).not.toContain("At least four players are required");
    expect(empty).toContain("disabled=\"\">Launch Game");
    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    const host = render(await sam.query(api.board.get, { code: "test" }));

    expect(host).toContain("Add NPC");
    expect(host).toContain("Remove ");
    expect(host).toContain("difficulty: medium");
    expect(host).toContain("npc-remove-button");
    expect(host).not.toContain("NPC difficulty</legend>");
    const lobbyBoard = await sam.query(api.board.get, { code: "test" });
    for (const npc of lobbyBoard.players.filter((player) => player.kind === "npc"))
    {
        expect(host).not.toContain(npc.tagline);
    }

    const guest = render(await bob.query(api.board.get, { code: "test" }));

    expect(guest).toContain("NPC · Medium");
    expect(guest).not.toContain("npc-add-tile");
    expect(guest).not.toContain("npc-remove-button");
    expect(guest).not.toContain("npc-difficulty-button");
    expect(guest).not.toContain("Add NPC</button>");
    expect(guest).not.toContain("Launch Game</button>");
    await client.close();
});
it("shows the NPC portrait and identity inside its portfolio without any private hand or decision details", async () =>
{
    const { sam } = await setup(5, 1);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });
    const npc = board.players[1];
    const html = renderToStaticMarkup(<Portfolio board={board} player={npc} />);

    expect(html).toContain(`<h3 class="text-black">${npc.name}</h3>`);
    expect(html.indexOf(npc.name)).toBeGreaterThan(html.indexOf("id=\"portfolio\""));
    expect(html).toContain(npc.profileRoot);
    expect(html).toContain(npc.tagline);
    expect(html).toContain("NPC · Medium");
    expect(html).not.toContain("Your Insights");
    expect(html).not.toContain("confidence");
    const status = renderToStaticMarkup(
        <NpcTurnStatus board={{ ...board, game: { ...board.game, currentPlayerId: npc._id } }} />,
    );

    expect(status).toContain("is considering a move…");
    expect(status).toContain("aria-live=\"polite\"");
});
