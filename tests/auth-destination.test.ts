import { expect, it } from "vitest";
import { authDestination } from "../shared/auth-destination";

it("retains a scanned game through sign-in and the sign-up switch", () =>
{
    expect(authDestination("/games/show/tv-night", "")).toBe("/games/show/tv-night");
    expect(authDestination("/signup", "?next=%2Fgames%2Fshow%2Ftv-night")).toBe("/games/show/tv-night");
    expect(authDestination("/login", "?next=%2Fgames%2Fshow%2Ftv-night")).toBe("/games/show/tv-night");
});

it("rejects external, malformed and non-game redirect targets", () =>
{
    for (const next of ["https://example.com", "//example.com", "/logout", "/games/show/../logout", "/games/show/a?next=x"])
    {
        expect(authDestination("/login", `?next=${encodeURIComponent(next)}`)).toBe("/");
    }
});
