import { useEffect, useState } from "react";
import type { Board } from "./display-types";
import { actionAnimationMs } from "../shared/presentation";
import { FeedMessage } from "./FeedMessage";
import { newPlayEvents } from "./play-events";

export function PlayAnimation({ board, preview = false }: { board: Board; preview?: boolean })
{
    const newest = board.feed[0];
    const [state, setState] = useState(() => ({ id: newest?._id, at: newest?._creationTime ?? -Infinity,
        queue: preview && newest ? [newest] : [] as Board["feed"] }));
    if (newest?._id !== state.id)
    {
        setState({ id: newest?._id, at: newest?._creationTime ?? -Infinity,
            queue: [...state.queue, ...newPlayEvents(board, state.id, state.at)] });
    }

    const active = state.queue[0];

    useEffect(() =>
    {
        if (!active)
        {
            return;
        }

        const timer = globalThis.setTimeout(() =>
        {
            setState((old) => ({ ...old, queue: old.queue.slice(1) }));
        }, actionAnimationMs);

        return () => globalThis.clearTimeout(timer);
    }, [active]);

    if (!active)
    {
        return null;
    }

    const player = board.players.find((candidate) => candidate.name === active.title);

    return (
        <div key={active._id} id="play-notif" className="play-notification d-flex justify-content-center align-items-center" role="status" aria-live="polite">
            <div className="d-flex flex-column align-items-center text-center gap-3">
                <img className="rounded" src={active.imageRoot || player?.profileRoot} alt={active.title} />
                <h1>{active.title}</h1>
                <FeedMessage item={active} stocks={board.stocks} detailed />
            </div>
        </div>
    );
}
