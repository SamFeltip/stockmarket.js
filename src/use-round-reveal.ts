import { useEffect, useState } from "react";

export function useRoundReveal({ step, summary, count, paused, delay }: {
    step: number; summary: boolean; count: number; paused: boolean; delay: number;
})
{
    const [animation, setAnimation] = useState({ step, index: 0 });
    const index = summary ? count : (animation.step === step ? animation.index : 0);

    useEffect(() =>
    {
        if (paused || index >= count)
        {
            return;
        }

        const timer = globalThis.setTimeout(() => setAnimation({ step, index: index + 1 }), delay);

        return () => globalThis.clearTimeout(timer);
    }, [step, index, count, paused, delay]);

    return index;
}
