import { useState } from "react";
import { useAction } from "./shared";

export function SpectatorSkip({ onDecision }: { onDecision?: (quantity: number) => Promise<unknown> })
{
    const [confirming, setConfirming] = useState(false);
    const { run, busy, error } = useAction();

    return (
        <div className="rights-skip">
            {error && <p role="alert">{error}</p>}
            {confirming ? (
                <>
                    <span>Skip this shareholder’s choice?</span>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() =>
                        {
                            void run(async () =>
                            {
                                await onDecision?.(0);
                            });
                        }}
                    >
                        Confirm skip
                    </button>
                </>
            ) : <button className="btn btn-secondary" onClick={() => setConfirming(true)}>Skip</button>}
        </div>
    );
}
