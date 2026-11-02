import { afterEach, expect, it, vi } from "vitest";
import { setupStandaloneSafeArea } from "../src/standalone-safe-area";

afterEach(() => vi.unstubAllGlobals());

for (const matches of [false, true])
{
    it(`only extends the viewport when mobile standalone matches: ${matches}`, () =>
    {
        const viewport = { content: "width=device-width, initial-scale=1" };
        const media = Object.assign(new EventTarget(), { matches });
        const matchMedia = vi.fn(() => media);

        vi.stubGlobal("matchMedia", matchMedia);
        vi.stubGlobal("document", { querySelector: () => viewport });
        const cleanup = setupStandaloneSafeArea();

        expect(matchMedia).toHaveBeenCalledWith("(max-width: 991.98px) and (display-mode: standalone)");
        expect(viewport.content).toBe(matches
            ? "width=device-width, initial-scale=1, viewport-fit=cover"
            : "width=device-width, initial-scale=1");
        media.matches = !matches;
        media.dispatchEvent(new Event("change"));
        expect(viewport.content.includes("viewport-fit=cover")).toBe(!matches);
        cleanup();
        expect(viewport.content).toBe("width=device-width, initial-scale=1");
        media.matches = true;
        media.dispatchEvent(new Event("change"));
        expect(viewport.content).toBe("width=device-width, initial-scale=1");
    });
}
