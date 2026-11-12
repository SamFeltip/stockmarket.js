import { packLengths, type Pack } from "../shared/packs";
import "./game-length.css";

export function GameLengthControl({ periods, pack, busy, retainFocus = false, onChange }: {
    periods: number; pack?: Pack; busy: boolean; retainFocus?: boolean; onChange?: (periods: number) => void;
})
{
    const lengths = packLengths(pack);
    const index = lengths.indexOf(periods);
    const fewer = !busy && index > 0;
    const more = !busy && index >= 0 && index < lengths.length - 1;

    return (
        <div className="game-length-control" role="group" aria-label="Game length">
            {onChange && (
                <button
                    type="button"
                    className="btn bg-dark"
                    aria-label="Fewer periods"
                    disabled={!retainFocus && !fewer}
                    aria-disabled={retainFocus && !fewer ? true : undefined}
                    onClick={() =>
                    {
                        if (fewer)
                        {
                            onChange(lengths[index - 1]);
                        }
                    }}
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
                    disabled={!retainFocus && !more}
                    aria-disabled={retainFocus && !more ? true : undefined}
                    onClick={() =>
                    {
                        if (more)
                        {
                            onChange(lengths[index + 1]);
                        }
                    }}
                >
                    +
                </button>
            )}
        </div>
    );
}
