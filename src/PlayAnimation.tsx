import { RolePortrait } from "./RolePortrait";
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

    const activeId = active?._id;

    useEffect(() =>
    {
        if (!activeId)
        {
            return;
        }

        const timer = globalThis.setTimeout(() =>
        {
            setState((old) => old.queue[0]?._id === activeId ? { ...old, queue: old.queue.slice(1) } : old);
        }, actionAnimationMs);

        return () => globalThis.clearTimeout(timer);
    }, [activeId]);

    if (!active)
    {
        return null;
    }

    const player = board.players.find((candidate) => candidate.name === active.title);

    return (
        <div key={active._id} id="play-notif" className="play-notification d-flex justify-content-center align-items-center" role="status" aria-live="polite">
            <div className="d-flex flex-column align-items-center text-center gap-3">
                <RolePortrait name={active.title} profileRoot={active.imageRoot || player?.profileRoot || ""} role={active.roleAfter} />
                <h1>{active.title}</h1>
                <FeedMessage item={active} stocks={board.stocks} detailed />
            </div>
            <button
                type="button"
                className="play-notification-dismiss"
                aria-label="Dismiss play notification"
                onClick={() => setState((old) => old.queue[0]?._id === activeId
                    ? { ...old, queue: old.queue.slice(1) } : old)}
            />
        </div>
    );
}
