import { afterEach, expect, it, vi } from "vitest";
import { setupStandaloneSafeArea } from "../src/standalone-safe-area";

afterEach(() => vi.unstubAllGlobals());

for (const [label, isMobile, displayMode, iosStandalone, expected] of [
    ["normal mobile browser", true, false, false, false],
    ["mobile display-mode standalone", true, true, false, true],
    ["iOS fallback without display-mode support", true, false, true, true],
    ["desktop installed app", false, true, true, false],
    ["missing iOS property in normal browser", true, false, undefined, false],
] as const)
{
    it(`uses the same viewport and padding detection for ${label}`, () =>
    {
        const viewport = { content: "width=device-width, initial-scale=1" };
        const mobile = Object.assign(new EventTarget(), { matches: isMobile });
        const standalone = Object.assign(new EventTarget(), { matches: displayMode });
        const classes = new Set<string>();
        const classList = {
            contains: (name: string) => classes.has(name),
            toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        };

        vi.stubGlobal("matchMedia", vi.fn((query: string) => query === "(display-mode: standalone)" ? standalone : mobile));
        vi.stubGlobal("navigator", { standalone: iosStandalone });
        vi.stubGlobal("document", { querySelector: () => viewport, documentElement: { classList } });
        const cleanup = setupStandaloneSafeArea();

        expect(classes.has("mobile-standalone")).toBe(expected);
        expect(viewport.content).toBe(expected
            ? "width=device-width, initial-scale=1, viewport-fit=cover"
            : "width=device-width, initial-scale=1");
        // Leaving the mobile breakpoint must undo both the viewport and padding.
        mobile.matches = false;
        mobile.dispatchEvent(new Event("change"));
        expect(classes.has("mobile-standalone")).toBe(false);
        expect(viewport.content).toBe("width=device-width, initial-scale=1");
        mobile.matches = true;
        mobile.dispatchEvent(new Event("change"));
        expect(classes.has("mobile-standalone")).toBe(displayMode || iosStandalone === true);
        cleanup();
        expect(classes.has("mobile-standalone")).toBe(false);
        expect(viewport.content).toBe("width=device-width, initial-scale=1");
        standalone.dispatchEvent(new Event("change"));
        expect(classes.has("mobile-standalone")).toBe(false);
    });
}

it("refreshes installed-mode detection when iOS restores an existing page", () =>
{
    const viewport = { content: "width=device-width, initial-scale=1" };
    const classes = new Set<string>();
    const page = new EventTarget();
    const ios = { standalone: false };
    const mobile = Object.assign(new EventTarget(), { matches: true });
    const standalone = Object.assign(new EventTarget(), { matches: false });

    vi.stubGlobal("matchMedia", (query: string) => query === "(display-mode: standalone)" ? standalone : mobile);
    vi.stubGlobal("navigator", ios);
    vi.stubGlobal("addEventListener", page.addEventListener.bind(page));
    vi.stubGlobal("removeEventListener", page.removeEventListener.bind(page));
    vi.stubGlobal("document", { querySelector: () => viewport, documentElement: { classList: {
        contains: (name: string) => classes.has(name),
        toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
    } } });
    const cleanup = setupStandaloneSafeArea();

    ios.standalone = true;
    page.dispatchEvent(new Event("pageshow"));
    expect(classes.has("mobile-standalone")).toBe(true);
    expect(viewport.content).toContain("viewport-fit=cover");
    cleanup();
    page.dispatchEvent(new Event("pageshow"));
    expect(classes.has("mobile-standalone")).toBe(false);
});
