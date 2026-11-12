import { useEffect, useRef } from "react";

export function SuspensionSkipConfirmation({ busy, error, onCancel, onConfirm }: {
    busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
})
{
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() =>
    {
        dialog.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialog}
            className="suspension-confirm"
            aria-labelledby="suspension-skip-title"
            onCancel={(event) =>
            {
                event.preventDefault();

                if (!busy)
                {
                    onCancel();
                }
            }}
        >
            <h2 id="suspension-skip-title">Skip Share Suspended?</h2>
            <p>This card will be spent and won’t carry over to the next bargaining period.</p>
            {error && <p className="alert alert-danger" role="alert">{error}</p>}
            <div className="trade-footer">
                <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
                <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>Confirm skip</button>
            </div>
        </dialog>
    );
}
