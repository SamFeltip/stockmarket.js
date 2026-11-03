import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Alert, Modal, useAction } from "./shared";
import { hideModal } from "./bootstrap";
import { DebentureStockChoice } from "./DebentureModal";
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
    const stocks = board.stocks.filter((stock) => stock.display
      && board.game.prices.some((price) => price.stockKey === stock.key && price.value > 0)
      && board.players.some((player) => player.holdings.some((holding) =>
          holding.stockKey === stock.key && holding.quantity > 0)));
    const id = `chance-card-${insightId}`;

    function close()
    {
        const element = document.querySelector<HTMLElement>(`#${id}`);
        if (element)
        {
            hideModal(element);
        }
    }

    return (
        <Modal id={id} title="Rights Issue" mobileDrawer>
            <div className="modal-body loan-detail debenture-detail d-grid gap-3">
                <h2 className="text-black mb-0">Rights Issue</h2>
                <p>Choose a company. Every holder may buy one extra share for every two they own, at £1 each.</p>
                <p>Single use. Activating takes one turn. Trading pauses while shareholders choose.</p>
                <div className="debenture-stock-list" role="radiogroup" aria-label="Rights Issue company">
                    {stocks.map((stock) => (
                        <DebentureStockChoice
                            key={stock.key}
                            name={`${id}-company`}
                            selected={selected === stock.key}
                            busy={busy}
                            onSelect={() => setSelected(stock.key)}
                            offer={{ stockKey: stock.key, stock,
                                quantity: board.player.holdings.find((holding) =>
                                    holding.stockKey === stock.key)?.quantity ?? 0,
                                unitPrice: 1, amount: 0, claimUntilPeriod: null, unavailableReason: null }}
                        />
                    ))}
                    {stocks.length === 0 && <div className="debenture-empty">No companies with shareholders</div>}
                </div>
                {!myTurn && <p>Wait for your turn to activate.</p>}
                <Alert message={error} />
            </div>
            <div className="modal-footer trade-footer">
                <button className="btn btn-secondary" disabled={busy} onClick={close}>Close</button>
                <button
                    className="btn btn-primary"
                    disabled={busy || used || !myTurn || selected === undefined}
                    onClick={() =>
                    {
                        if (!myTurn || used || busy || selected === undefined)
                        {
                            return;
                        }

                        void run(async () =>
                        {
                            await (onActivate ? onActivate(insightId, selected) : activate({ code: board.game.code,
                                expectedTurn: board.game.turn, expectedPeriod: board.game.currentPeriod,
                                insightId, stockKey: selected }));
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
