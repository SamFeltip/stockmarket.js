import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";
import { Waiting } from "../src/GamePage";
import { SpectatorScreen } from "../src/spectator/SpectatorPage";
import { RoundEnd } from "../src/RoundEnd";
import type { ReactNode } from "react";

const client = new ConvexReactClient("https://spectator-lobby-test.invalid");
const render = (screen: ReactNode) => renderToStaticMarkup(
    <ConvexProvider client={client}><MemoryRouter>{screen}</MemoryRouter></ConvexProvider>,
);

afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

it("uses normal mobile lobby controls and the same NPC management on the spectator screen", async () =>
{
    vi.useFakeTimers();
    vi.stubGlobal("location", { origin: "https://stockmarket.samfelton.com" });
    const { sam, bob, t } = await setup();

    await sam.mutation(api.games.create, { code: "lobby-controls", periodCount: 5, spectate: true });
    await bob.mutation(api.games.join, { code: "lobby-controls" });
    await sam.mutation(api.npc.lobby.add, { code: "lobby-controls", required: true });
    const phone = await bob.query(api.board.get, { code: "lobby-controls" });
    const display = (await sam.query(api.tv.board, { code: "lobby-controls" }))!;
    const mobileHtml = render(<Waiting board={phone} />);
    const displayHtml = render(<SpectatorScreen board={display} />);
    for (const html of [mobileHtml, displayHtml])
    {
        expect(html).toContain("Add NPC");
        expect(html).toContain("npc-remove-button");
        expect(html).toContain("difficulty: medium");
        expect(html).toContain("Launch Game");
        expect(html).toContain("Game length");

        for (const player of phone.players)
        {
            expect(html).toContain(player.name);
            expect(html).toContain(player.profileRoot);
        }
    }

    expect(mobileHtml).toContain("npc-waiting-room");
    expect(displayHtml).toContain("website-lobby");
    const guest = (await t.query(api.tv.board, { code: "lobby-controls" }))!;
    const guestHtml = render(<SpectatorScreen board={guest} />);

    expect(guestHtml).not.toContain("Add NPC");
    expect(guestHtml).not.toContain("npc-remove-button");
    expect(guestHtml).toContain("NPC · Medium");

    const closed = { ...phone, game: { ...phone.game, status: "closed" as const }, stocks: [], insights: [] };
    const mobileSummary = render(<RoundEnd board={closed} />);

    expect(mobileSummary).toContain("Use the spectator display to start the next period.");
    expect(mobileSummary).not.toContain("Next Period");
    const normalSummary = render(
        <RoundEnd board={{ ...closed, game: { ...closed.game, spectatorControlled: false } }} />,
    );

    expect(normalSummary).toContain("Next Period");
});
