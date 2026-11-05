import { gameLengths } from "../shared/rules";

export function GameLengthControl({ periods, busy, onChange }: {
    periods: number; busy: boolean; onChange?: (periods: number) => void;
})
{
    const index = gameLengths.findIndex((length) => length === periods);

    return (
        <>
            <div className="game-length-mobile" role="group" aria-label="Game length">
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
            {onChange ? (
                <div
                    className="game-length-desktop radio-row flex-wrap justify-content-center gap-2"
                    id="difficulty-options-setter"
                >
                    {gameLengths.map((length) => (
                        <span key={length}>
                            <input
                                type="radio"
                                className="btn-check"
                                name="game-length"
                                id={`option${length}`}
                                checked={periods === length}
                                disabled={busy}
                                onChange={() => onChange(length)}
                            />
                            <label className="btn bg-dark" htmlFor={`option${length}`}>{`${length} periods`}</label>
                        </span>
                    ))}
                </div>
            ) : <div className="game-length-desktop btn bg-dark" id="game-difficulty">{`${periods} periods`}</div>}
        </>
    );
}
