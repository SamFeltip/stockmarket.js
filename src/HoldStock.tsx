import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Alert, useAction } from "./shared";
import type { Board, Insight } from "./types";

export function HoldStock({ board, insight }: { board: Board; insight: Insight })
{
    const hold = useMutation(api.rounds.hold);
    const [stockKey, setStockKey] = useState<number | undefined>();
    const { run, busy, error } = useAction();
    const player = board.players.find((seat) => seat._id === insight.playerId);
    const own = insight.playerId === board.player._id;

    return (
        <div className="bg-white text-black rounded p-4">
            <h2 className="text-black">{own ? "Would you like to suspend a share?" : `Waiting for ${player?.name} to suspend a share`}</h2>
            <Alert message={error} />
            <div className="d-grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                {board.stocks.filter((stock) => stock.display).map((stock) => (
                    <label className="btn btn-outline-secondary" key={stock.key}>
                        <input
                            type="radio"
                            name={`hold-${insight._id}`}
                            disabled={!own || busy}
                            checked={stockKey === stock.key}
                            onChange={() =>
                            {
                                setStockKey(stock.key);
                            }}
                        />
                        <img height={64} src={stock.imagePath} alt={stock.name} />
                        <p>
                            £
                            {board.game.prices.find((price) => price.stockKey === stock.key)?.value.toFixed(2)}
                        </p>
                    </label>
                ))}
            </div>
            {own && (
                <div className="d-flex gap-2 mt-3">
                    <button
                        className="btn btn-secondary flex-fill"
                        disabled={busy}
                        onClick={() =>
                        {
                            void run(() => hold({ code: board.game.code, insightId: insight._id }));
                        }}
                    >
                        Skip
                    </button>
                    <button
                        className="btn btn-success flex-fill"
                        disabled={busy || stockKey === undefined}
                        onClick={() =>
                        {
                            void run(() => hold({ code: board.game.code, insightId: insight._id, stockKey }));
                        }}
                    >
                        Confirm
                    </button>
                </div>
            )}
        </div>
    );
}
