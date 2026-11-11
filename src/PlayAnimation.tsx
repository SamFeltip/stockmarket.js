import { RolePortrait } from "./RolePortrait";
import { useEffect, useState } from "react";
import type { Board } from "./display-types";
import { actionAnimationMs } from "../shared/presentation";
import { FeedMessage } from "./FeedMessage";
import { newPlayEvents } from "./play-events";

export function PlayAnimation({ board, preview = false }: { board: Board; preview?: boolean })
{
    const newest = board.feed[0];
    const revealing = board.game.status === "closed" || board.game.status === "special_insights";
    const [state, setState] = useState(() => ({ id: newest?._id, at: newest?._creationTime ?? -Infinity,
        queue: preview && newest ? [newest] : [] as Board["feed"] }));
    if (newest?._id !== state.id || (revealing && state.queue.length > 1))
    {
        const queue = [...state.queue, ...newPlayEvents(board, state.id, state.at)];

        setState({ id: newest?._id, at: newest?._creationTime ?? -Infinity,
            queue: revealing ? queue.slice(-1) : queue });
    }

    const active = state.queue[0];

    const activeId = active?._id;
    const expiresAt = revealing && active ? active._creationTime + actionAnimationMs : undefined;

    useEffect(() =>
    {
        if (!activeId)
        {
            return;
        }

        const timer = globalThis.setTimeout(() =>
        {
            setState((old) => old.queue[0]?._id === activeId ? { ...old, queue: old.queue.slice(1) } : old);
        }, expiresAt === undefined ? actionAnimationMs : Math.max(0, expiresAt - Date.now()));

        return () => globalThis.clearTimeout(timer);
    }, [activeId, expiresAt]);

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
