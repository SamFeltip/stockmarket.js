import { useEffect, useRef } from "react";
import { bootstrapTooltip } from "../bootstrap";
export function LaunchGameButton({
    disabled,
    onLaunch,
}: {
    disabled: boolean;
    onLaunch: () => void;
})
{
    const target = useRef<HTMLSpanElement>(null);

    useEffect(() =>
    {
        if (!target.current)
        {
            return;
        }

        const tooltip = bootstrapTooltip(target.current, "minimum 4 players required");

        return () =>
        {
            tooltip?.dispose();
        };
    }, []);

    return (
        <span
            ref={target}
            className="launch-game-tooltip"
            role={disabled ? "button" : undefined}
            tabIndex={disabled ? 0 : undefined}
            aria-label={disabled ? "Launch Game: minimum 4 players required" : undefined}
            aria-disabled={disabled}
            data-bs-toggle="tooltip"
            data-bs-custom-class="launch-game-help"
            data-bs-title="minimum 4 players required"
        >
            <button
                type="button"
                className="btn btn-primary w-100"
                disabled={disabled}
                onClick={onLaunch}
            >
                Launch Game
            </button>
        </span>
    );
}
