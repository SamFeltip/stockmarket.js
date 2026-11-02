import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { governmentLoanAmount } from "../shared/chance-cards";
import { hideModal } from "./bootstrap";
import { Alert, Modal, money, useAction } from "./shared";
import type { Board } from "./types";

export type LoanActivation = (insightId: Board["insights"][number]["_id"]) => Promise<void>;

export function GovernmentLoanModal({ board, insightId, used, onActivate }: {
    board: Board; insightId: Board["insights"][number]["_id"]; used: boolean; onActivate?: LoanActivation;
})
{
    const activate = useMutation(api.trading.activateGovernmentLoan);
    const { run, busy, error } = useAction();
    const canActivate = !used && board.game.status === "playing" && board.game.currentPlayerId === board.player._id;
    const id = `chance-card-${insightId}`;

    function closeDialog()
    {
        const dialog = document.querySelector<HTMLElement>(`#${id}`);
        if (dialog)
        {
            hideModal(dialog);
        }
    }

    return (
        <Modal id={id} title="Government Loan" mobileDrawer>
            <div className="modal-body loan-detail d-grid gap-3">
                <h2 className="text-black mb-0">Government Loan</h2>
                <h3>{`Receive £${money(governmentLoanAmount)}`}</h3>
                <p>This bonus goes straight into your cash balance. Invest it in shares or save it for later.</p>
                <p>You can use this card once. Activating it uses one turn.</p>
                {!canActivate && <p>{used ? "This card has been used." : "Wait for your turn to activate."}</p>}
                <Alert message={error} />
            </div>
            <div className="modal-footer trade-footer">
                <button type="button" className="btn btn-secondary" onClick={closeDialog} disabled={busy}>Cancel</button>
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canActivate || busy}
                    onClick={() =>
                    {
                        if (!canActivate || busy)
                        {
                            return;
                        }

                        void run(async () =>
                        {
                            await (onActivate ? onActivate(insightId) : activate({ code: board.game.code,
                                expectedTurn: board.game.turn, expectedPeriod: board.game.currentPeriod, insightId }));
                            closeDialog();
                        });
                    }}
                >
                    {busy ? "Activating…" : "Activate"}
                </button>
            </div>
        </Modal>
    );
}
