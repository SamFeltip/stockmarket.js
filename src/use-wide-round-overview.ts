import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string)
{
    const subscribe = useCallback((onChange: () => void) =>
    {
        const media = matchMedia(query);

        media.addEventListener("change", onChange);

        return () => media.removeEventListener("change", onChange);
    }, [query]);
    const matches = () => matchMedia(query).matches;

    return useSyncExternalStore(subscribe, matches, () => false);
}

export function useWideRoundOverview()
{
    return useMediaQuery("(min-width: 768px) and (min-height: 720px)");
}
