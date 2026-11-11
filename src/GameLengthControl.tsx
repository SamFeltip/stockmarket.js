import { packLengths, type Pack } from "../shared/packs";
import "./game-length.css";

export function GameLengthControl({ periods, pack, busy, onChange }: {
    periods: number; pack?: Pack; busy: boolean; onChange?: (periods: number) => void;
})
{
    const lengths = packLengths(pack);
    const index = lengths.indexOf(periods);

    return (
        <div className="game-length-control" role="group" aria-label="Game length">
            {onChange && (
                <button
                    type="button"
                    className="btn bg-dark"
                    aria-label="Fewer periods"
                    disabled={busy || index <= 0}
                    onClick={() => onChange(lengths[index - 1])}
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
                    disabled={busy || index < 0 || index >= lengths.length - 1}
                    onClick={() => onChange(lengths[index + 1])}
                >
                    +
                </button>
            )}
        </div>
    );
}
