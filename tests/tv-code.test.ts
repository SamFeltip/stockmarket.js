import { expect, it } from "vitest";
import { generateTvCode } from "../shared/tv-code";

it("moves to a longer code after three collisions at each length", async () =>
{
    const attempts: string[] = [];
    const code = await generateTvCode((candidate) =>
    {
        attempts.push(candidate);

        return Promise.resolve(candidate.length < 9);
    }, () => 0);

    expect(attempts).toEqual(["tv-aaaa", "tv-aaaa", "tv-aaaa", "tv-aaaaa", "tv-aaaaa", "tv-aaaaa", "tv-aaaaaa"]);
    expect(code).toBe("tv-aaaaaa");
});
