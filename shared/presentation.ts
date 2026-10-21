// Keep turn scheduling and both clients on the same presentation timing.
export const actionAnimationMs = 3500;

export const revealPauseMs = 500;

export const revealStartDelayMs = actionAnimationMs + revealPauseMs;

export function revealDelay(lastActionAt: number | undefined, now = Date.now())
{
    return lastActionAt === undefined ? 0 : Math.max(0, lastActionAt + revealStartDelayMs - now);
}
