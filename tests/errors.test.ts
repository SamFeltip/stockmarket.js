import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { friendlyError, usernameHelp } from "../src/errors";
import { resolveTradeDraft, sharesForCash, stepShares } from "../src/trades";

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
    it("updates shares from the first cash edit and stays linked when price or limits change", () =>
    {
        const draft = { field: "cash", value: "7500" } as const;

        expect(resolveTradeDraft(draft, 2.5, 20_000).shares).toBe("3000");
        expect(resolveTradeDraft(draft, 1.5, 20_000).shares).toBe("5000");
        expect(resolveTradeDraft(draft, 2.5, 1000).shares).toBe("1000");
        expect(resolveTradeDraft({ field: "shares", value: "3000" }, 2.5, 20_000).cash).toBe("7500");
        expect(resolveTradeDraft({ field: "cash", value: "" }, 2.5, 20_000).quantity).toBe(0);
    });
    it("buys whole lots and handles decimal stock prices without rounding down exact lots", () =>
    {
        expect(sharesForCash(2500, 2.5)).toBe(1000);
        expect(sharesForCash(2499.99, 2.5)).toBe(0);
        expect(sharesForCash(7501, 2.5)).toBe(3000);
        expect(sharesForCash(870, 0.29)).toBe(3000);
    });
    it("selects permitted trade sizes within cash and steps by 1,000 at every trade size", () =>
    {
        expect(sharesForCash(15_000, 2.5)).toBe(6000);
        expect(sharesForCash(24_999.99, 2.5)).toBe(9000);
        expect(sharesForCash(25_000, 2.5)).toBe(10_000);
        expect(sharesForCash(37_500, 2.5)).toBe(15_000);
        expect(sharesForCash(50_000, 2.5)).toBe(20_000);
        expect(stepShares(4000, 1)).toBe(5000);
        expect(stepShares(5000, 1)).toBe(6000);
        expect(stepShares(10_000, -1)).toBe(9000);
        expect(stepShares(20_000, -1)).toBe(19_000);
        expect(stepShares(6000, 1)).toBe(7000);
        expect(stepShares(6000, -1)).toBe(5000);
        expect(stepShares(0, -1)).toBe(0);
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
