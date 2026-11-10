import { gameLengths } from "../shared/rules";

export function GameLengthControl({ periods, busy, onChange }: {
    periods: number; busy: boolean; onChange?: (periods: number) => void;
})
{
    const index = gameLengths.indexOf(periods);

    return (
        <div className="game-length-control" role="group" aria-label="Game length">
            {onChange && (
                <button
                    type="button"
                    className="btn bg-dark"
                    aria-label="Fewer periods"
                    disabled={busy || index <= 0}
                    onClick={() => onChange(gameLengths[index - 1])}
                >
                    −
                </button>
            )}
            <div className="game-length-value bg-white text-black rounded" aria-live="polite" aria-atomic="true">
                <strong>{periods}</strong>
                <span>periods</span>
            </div>
            {onChange && (
                <button
                    type="button"
                    className="btn bg-dark"
                    aria-label="More periods"
                    disabled={busy || index < 0 || index >= gameLengths.length - 1}
                    onClick={() => onChange(gameLengths[index + 1])}
                >
                    +
                </button>
            )}
        </div>
    );
}
