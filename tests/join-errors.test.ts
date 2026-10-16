import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { describeJoinError } from "../src/join-error";

describe("Joining a game", () =>
{
    it("explains a missing lobby and keeps the code available for correction", () =>
    {
        const result = describeJoinError(new ConvexError("No game found!"), "missing-lobby");

        expect(result.title).toBe("Game not found");
        expect(result.message).toContain("missing-lobby");
        expect(result.message).toContain("Check the code with your host");
    });

    const failures = [
        ["This lobby is full", "This game is full"],
        ["This game has already started", "This game has started"],
        ["Lobby code must contain 1–32 letters, numbers, hyphens or underscores", "Check your lobby code"],
    ];
    for (const [message, title] of failures)
    {
        it(`explains why joining failed: ${message}`, () =>
        {
            expect(describeJoinError(new ConvexError(message), "test").title).toBe(title);
        });
    }

    it("does not expose technical details from unexpected failures", () =>
    {
        const result = describeJoinError(new Error("[CONVEX M(games:join)] Request ID: private-debug-detail"), "test");

        expect(result.message).toContain("Check your connection");
        expect(JSON.stringify(result)).not.toContain("CONVEX");
        expect(JSON.stringify(result)).not.toContain("private-debug-detail");
    });
});
