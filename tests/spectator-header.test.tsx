import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SpectatorHeader } from "../src/SpectatorHeader";

const board = {
    game: { code: "demo", turn: 5, currentPeriod: 2, periodCount: 5, currentPlayerId: "sam" },
    players: ["sam", "bob", "pat", "lee"].map((id) => ({ _id: id, name: id === "sam" ? "Sam" : id })),
};

it("uses the same spectator identity, branding and game progress in normal play and Rights Issue", () =>
{
    const normal = renderToStaticMarkup(<SpectatorHeader board={board} />);
    const paused = renderToStaticMarkup(<SpectatorHeader board={board} paused />);
    for (const html of [normal, paused])
    {
        expect(html).toContain("Spectator view");
        expect(html).toContain("Lobby: DEMO");
        expect(html).toContain("Stockmarket!");
        expect(html).toContain("of 12");
        expect(html).toContain("aria-label=\"Period progress\" value=\"3\" max=\"6\"");
    }

    expect(normal).toContain("Sam’s turn");
    expect(normal).not.toContain("Gameplay paused");
    expect(paused).toContain("Gameplay paused during Rights Issue");
});
