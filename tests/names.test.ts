import { expect, it } from "vitest";
import { validUsername } from "../shared/names";

it("accepts names with spaces, punctuation and international characters", () =>
{
    for (const name of ["Sam Felton", "O’Connor", "José & 李", "Sam 🚀", "  sam  "])
    {
        expect(validUsername(name)).toBe(true);
    }

    for (const name of ["", "   ", "a".repeat(33), "sam\nfelton"])
    {
        expect(validUsername(name)).toBe(false);
    }
});
