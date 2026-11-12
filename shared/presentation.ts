import type { Pack } from "./packs";

// Keep turn scheduling and both clients on the same presentation timing.
export const actionAnimationMs = 3500;

export const revealPauseMs = 500;

export const revealStartDelayMs = actionAnimationMs + revealPauseMs;

const standardReveal = { interval: 2500, fastAnimation: false };
const insightReveals = {
    classic: standardReveal,
    frantic: standardReveal,
    tech: { interval: 250, fastAnimation: true },
} satisfies Record<Pack, typeof standardReveal>;

export function insightRevealPresentation(pack: Pack = "classic")
{
    return insightReveals[pack];
}

export function insightRevealMs(pack?: Pack)
{
    return insightRevealPresentation(pack).interval;
}

export function revealDelay(lastActionAt: number | undefined, now = Date.now())
{
    return lastActionAt === undefined ? 0 : Math.max(0, lastActionAt + revealStartDelayMs - now);
}
