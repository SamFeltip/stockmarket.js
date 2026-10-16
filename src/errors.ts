import { ConvexError } from "convex/values";

export const usernameHelp = "Choose a username with 1–32 letters, numbers, hyphens or underscores.";

const messages: Record<string, string> = {
    "At least two players are required": "Invite another player before launching the game.",
    "Invalid game length": "Choose a game length between 6 and 10 periods.",
    "This game has already started": "This game has started. Please join a new lobby instead.",
    "The game has already started": "This game has already started. You can continue on the game board.",
    "This lobby is full": "All six places in this lobby are taken. Try another lobby or create your own.",
    "This stock cannot be traded": "Trading is unavailable for this stock. Please choose another.",
    "Join this game first": "Join the lobby before opening its game board.",
    "Wait for players to resolve their hold-stock insights": "Waiting for players to choose or skip their held stocks.",
    "This insight cannot be used": "That insight is no longer available. Please check the updated round.",
    "This is not a hold-stock insight": "Please choose a hold-stock insight to suspend a stock price.",
    "Choose a tradable stock": "Choose one of the available stocks.",
    "Choose a stock": "Choose a stock before buying or selling shares.",
    "Not enough insights for all players": "The game deck is incomplete. Please ask the game owner to check it.",
    "Invalid description": "Enter an insight description between 1 and 2,000 characters.",
    "Insight not found": "That insight is no longer available. Refresh the page and try again.",
    "Lobby code already exists": "That lobby code is already taken. Please choose another.",
    "Please log in": "Your session has ended. Please log in again.",
    "No game found!": "We couldn't find that game. Check the lobby code and try again.",
    "Not enough cash": "You don't have enough cash for this purchase. Try fewer shares.",
    "Not enough shares available": "There aren't enough shares available. Try a smaller purchase.",
    "Not enough shares to sell": "You can't sell more shares than you own.",
    "Trade a positive number of shares in lots of 1000": "Enter a share amount in multiples of 1,000.",
    "The turn has changed; try again": "The turn has moved on. Please check the board and try again.",
    "It is not your turn": "Please wait for your turn before trading.",
    "The round has already changed": "The round has moved on. Please check the updated board.",
    "Only the lobby host can advance the round": "Only the game creator can start the next round or finish the game.",
};

export function friendlyError(error: unknown)
{
    const text = error instanceof Error ? error.message : "";
    const data = error instanceof ConvexError && typeof error.data === "string" ? error.data : "";
    if ((/Username must contain/.test(data || text) || data === usernameHelp))
    {
        return usernameHelp;
    }

    if (/Invalid credentials|InvalidAccountId|InvalidSecret/.test(text))
    {
        return "That username or password isn't correct. Please try again.";
    }

    if (/already exists|AccountAlreadyExists/.test(text) && !data)
    {
        return "That username is already taken. Try another or log in to your existing account.";
    }

    if (/Invalid password|at least 8/.test(text))
    {
        return "Choose a password with at least 8 characters.";
    }

    if (/TooMany|rate limit|too many/i.test(text))
    {
        return "Too many attempts. Please wait a moment before trying again.";
    }

    if (/network|fetch|offline|connection|timeout/i.test(text))
    {
        return "We couldn't connect. Check your internet connection and try again.";
    }

    // Only deliberate application errors are safe to display; never expose server traces.
    if (data)
    {
        return messages[data] ?? (data.endsWith(".") ? data : `${data}.`);
    }

    return "Something went wrong. Please try again in a moment.";
}
