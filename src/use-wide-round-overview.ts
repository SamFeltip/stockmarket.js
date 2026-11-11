import { useSyncExternalStore } from "react";

const wideOverviewQuery = "(min-width: 768px) and (min-height: 720px)";

function subscribeToWideOverview(onChange: () => void)
{
    const query = matchMedia(wideOverviewQuery);

    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
}

const isWideOverview = () => matchMedia(wideOverviewQuery).matches;

export function useWideRoundOverview()
{
    return useSyncExternalStore(subscribeToWideOverview, isWideOverview, () => false);
}
