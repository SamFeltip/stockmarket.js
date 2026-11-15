import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Id } from "../convex/_generated/dataModel";
import { Home } from "../src/Pages";
import { readRecentGames, rememberRecentGame } from "../src/recent-games";

const userId = "current-user" as Id<"users">;
const otherUserId = "other-user" as Id<"users">;

beforeEach(() =>
{
    const entries = new Map<string, string>();

    vi.stubGlobal("localStorage", {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
    });
});

afterEach(() =>
{
    vi.unstubAllGlobals();
});

it("keeps the latest twelve games per account and updates the view when a game is reopened", () =>
{
    for (let index = 1; index <= 13; index += 1)
    {
        rememberRecentGame(userId, { code: `lobby-${index}`, view: "play" });
    }

    rememberRecentGame(userId, { code: "lobby-3", view: "spectate" });

    const recent = readRecentGames(userId);

    expect(recent).toHaveLength(12);
    expect(recent.slice(0, 3)).toEqual([
        { code: "lobby-3", view: "spectate" },
        { code: "lobby-13", view: "play" },
        { code: "lobby-12", view: "play" },
    ]);
    expect(recent.filter(({ code }) => code === "lobby-3")).toHaveLength(1);
    expect(recent.some(({ code }) => code === "lobby-1")).toBe(false);
    expect(readRecentGames(otherUserId)).toEqual([]);
});

it("links to the saved player and display routes from home", () =>
{
    rememberRecentGame(userId, { code: "player-lobby", view: "play" });
    rememberRecentGame(userId, { code: "display-lobby", view: "spectate" });

    const home = renderToStaticMarkup(
        <MemoryRouter>
            <Home user={{ _id: userId, name: "Player", profileRoot: "/profile.webp" }} />
        </MemoryRouter>,
    );

    expect(home).toContain("Recent games");
    expect(home).toMatch(/href="\/games\/show\/player-lobby"[^>]*>PLAYER-LOBBY<\/a>/);
    expect(home).toMatch(/href="\/spectate\/display-lobby"[^>]*>DISPLAY-LOBBY<\/a>/);
});

it("ignores malformed storage and tolerates blocked storage", () =>
{
    const key = `stockmarket-web:recent-games:v1:${userId}`;

    globalThis.localStorage.setItem(key, "invalid json");
    expect(readRecentGames(userId)).toEqual([]);

    globalThis.localStorage.setItem(key, JSON.stringify([
        null,
        { code: "fake/path", view: "play" },
        { code: "no-view" },
        { code: "valid", view: "spectate" },
    ]));
    expect(readRecentGames(userId)).toEqual([{ code: "valid", view: "spectate" }]);

    vi.stubGlobal("localStorage", undefined);
    expect(() => rememberRecentGame(userId, { code: "valid", view: "spectate" })).not.toThrow();
});
