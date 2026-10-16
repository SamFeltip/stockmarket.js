import { ConvexError } from "convex/values";

export function describeJoinError(error: unknown, code: string)
{
    const message = error instanceof ConvexError && typeof error.data === "string" ? error.data : "";
    if (message === "No game found!")
    {
        return {
            title: "Game not found",
            message: `We couldn't find a game with the code “${code}”. Check the code with your host or try another one.`,
        };
    }

    if (message === "This lobby is full")
    {
        return { title: "This game is full", message: "All 6 places are taken. Try another lobby or start your own game." };
    }

    if (message === "This game has already started")
    {
        return { title: "This game has started", message: "You can join a new game once its host opens a lobby." };
    }

    if (message.startsWith("Lobby code must contain"))
    {
        return { title: "Check your lobby code", message: "Use 1–32 letters, numbers, hyphens or underscores." };
    }

    return {
        title: "Couldn't join the game",
        message: "We couldn't connect you to the lobby. Check your connection and try again.",
    };
}
