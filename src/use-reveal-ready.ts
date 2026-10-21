import { useEffect, useState } from "react";
import { revealDelay } from "../shared/presentation";

export function useRevealReady(lastActionAt: number | undefined)
{
    const [ready, setReady] = useState(() => revealDelay(lastActionAt) === 0);

    useEffect(() =>
    {
        if (ready)
        {
            return;
        }

        const timer = setTimeout(() => setReady(true), revealDelay(lastActionAt));

        return () => clearTimeout(timer);
    }, [lastActionAt, ready]);

    return ready;
}
