import "./rights-issue-drawer.css";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Alert, Modal, useAction } from "./shared";
import { hideModal } from "./bootstrap";
import { StockChoice } from "./StockChoice";
import type { Board } from "./types";

export type RightsActivation = (insightId: Board["insights"][number]["_id"], stockKey: number) => Promise<unknown>;

export function RightsIssueModal({ board, insightId, used, onActivate }: {
    board: Board; insightId: Board["insights"][number]["_id"]; used: boolean; onActivate?: RightsActivation;
})
{
    const activate = useMutation(api.rightsIssue.activate);
    const [selected, setSelected] = useState<number>();
    const { run, busy, error } = useAction();
    const myTurn = board.game.status === "playing" && !board.game.rightsIssue
      && board.game.currentPlayerId === board.player._id;
    const stocks = board.stocks.filter((stock) => stock.display && board.players.some((player) =>
        player.holdings.some((holding) => holding.stockKey === stock.key && holding.quantity > 0)));
    const selectedStock = stocks.find((stock) => stock.key === selected);
    const id = `chance-card-${insightId}`;

    function close()
    {
        const element = document.querySelector<HTMLElement>(`#${id}`);
        if (element)
        {
            hideModal(element);
            setSelected(undefined);
        }
    }

    return (
        <Modal id={id} title="Rights Issue" mobileDrawer>
            <div className="modal-body loan-detail debenture-detail rights-issue-detail d-grid gap-3">
                <h2 className="text-black mb-0">Rights Issue</h2>
                <p>buy one extra share for every two you own at £1</p>
                <p>trading pauses while stakeholders purchase stock</p>
                <div className="debenture-stock-list" role="radiogroup" aria-label="Rights Issue company">
                    {stocks.map((stock) => (
                        <StockChoice
                            key={stock.key}
                            stock={stock}
                            quantity={board.player.holdings.find((holding) =>
                                holding.stockKey === stock.key)?.quantity ?? 0}
                            name={`${id}-company`}
                            selected={selected === stock.key}
                            disabled={busy}
                            onSelect={() => setSelected((current) => current === stock.key ? undefined : stock.key)}
                            allowDeselect
                            showName
                        />
                    ))}
                    {stocks.length === 0 && <div className="debenture-empty">No companies with shareholders</div>}
                </div>
                {!myTurn && <p>Wait for your turn to activate.</p>}
                <Alert message={error} />
            </div>
            <div className="modal-footer trade-footer">
                <button className="btn btn-secondary" disabled={busy} onClick={close}>Cancel</button>
                <button
                    className="btn btn-primary"
                    disabled={busy || used || !myTurn || !selectedStock}
                    onClick={() =>
                    {
                        if (!myTurn || used || busy || !selectedStock)
                        {
                            return;
                        }

                        void run(async () =>
                        {
                            await (onActivate ? onActivate(insightId, selectedStock.key) : activate({
                                code: board.game.code, expectedTurn: board.game.turn,
                                expectedPeriod: board.game.currentPeriod, insightId, stockKey: selectedStock.key,
                            }));
                            close();
                        });
                    }}
                >
                    Activate
                </button>
            </div>
        </Modal>
    );
}
