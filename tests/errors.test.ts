import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { friendlyError, usernameHelp } from "../src/errors";
import { sharesForCash } from "../src/trades";

describe("Friendly errors", () =>
{
    it("keeps server details and request identifiers out of unexpected failures", () =>
    {
        const error = new Error("[CONVEX M(auth:signIn)] [Request ID: secret] Server Error\n at auth.ts:12");

        expect(friendlyError(error)).toBe("Something went wrong. Please try again in a moment.");
        expect(friendlyError(new ConvexError({ internal: "details" }))).toBe(friendlyError(error));
    });
    it("explains invalid names, passwords and existing accounts", () =>
    {
        expect(friendlyError(new ConvexError("Username must contain valid characters"))).toBe(usernameHelp);
        expect(friendlyError(new ConvexError(usernameHelp))).toBe(usernameHelp);
        expect(friendlyError(new Error("InvalidSecret"))).toContain("username or password");
        expect(friendlyError(new Error("Account sam already exists"))).toContain("username is already taken");
        expect(friendlyError(new Error("Invalid password"))).toContain("8 characters");
    });
    it("gives useful recovery steps for connection and gameplay failures", () =>
    {
        expect(friendlyError(new TypeError("Failed to fetch"))).toContain("internet connection");
        expect(friendlyError(new ConvexError("Not enough cash"))).toContain("fewer shares");
        expect(friendlyError(new ConvexError("Lobby code already exists"))).toContain("choose another");
        expect(friendlyError(new Error("TooManyFailedAttempts"))).toContain("wait a moment");
    });
});

describe("Cash entry", () =>
{
    it("buys whole lots and handles decimal stock prices without rounding down exact lots", () =>
    {
        expect(sharesForCash(2500, 2.5)).toBe(1000);
        expect(sharesForCash(2499.99, 2.5)).toBe(0);
        expect(sharesForCash(7501, 2.5)).toBe(3000);
        expect(sharesForCash(870, 0.29)).toBe(3000);
    });
    it("handles cleared, invalid and untradeable values safely", () =>
    {
        for (const cash of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
        {
            expect(sharesForCash(cash, 2.5)).toBe(0);
        }

        expect(sharesForCash(1000, 0)).toBe(0);
    });
});
