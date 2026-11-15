import { useEffect } from "react";
import type { Id } from "../convex/_generated/dataModel";

interface RecentGame { code: string; view: "play" | "spectate" }
const limit = 12;

function storageKey(userId: Id<"users">)
{
    return `stockmarket-web:recent-games:v1:${userId}`;
}

function isRecentGame(item: unknown): item is RecentGame
{
    return typeof item === "object" && item !== null
      && "code" in item && typeof item.code === "string" && /^[a-z0-9_-]{1,32}$/.test(item.code)
      && "view" in item && (item.view === "play" || item.view === "spectate");
}

export function readRecentGames(userId: Id<"users">): RecentGame[]
{
    try
    {
        const stored: unknown = JSON.parse(globalThis.localStorage.getItem(storageKey(userId)) ?? "[]");

        return Array.isArray(stored) ? stored.filter((item) => isRecentGame(item)).slice(0, limit) : [];
    }
    catch
    {
        return [];
    }
}

export function rememberRecentGame(userId: Id<"users">, game: RecentGame)
{
    const recent = readRecentGames(userId).filter((item) => item.code !== game.code);

    try
    {
        globalThis.localStorage.setItem(storageKey(userId), JSON.stringify([game, ...recent].slice(0, limit)));
    }
    catch
    {
        // Browser storage is optional and should never prevent opening a game.
    }
}

export function useRememberRecentGame(userId: Id<"users"> | undefined, code: string | undefined, view: RecentGame["view"])
{
    useEffect(() =>
    {
        if (userId && code)
        {
            rememberRecentGame(userId, { code, view });
        }
    }, [userId, code, view]);
}
