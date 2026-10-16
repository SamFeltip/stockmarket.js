import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Alert, Change, Insights, Modal, money, useAction } from "./shared";
import type { Board, Stock } from "./types";

export function StockPreview({ board, stock, large = false, active = false }: {
    board: Board;
    stock: Stock;
    large?: boolean;
    active?: boolean;
})
{
    const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const value = board.insights.filter((insight) => insight.stockKey === stock.key)
        .reduce((sum, insight) => sum + insight.value, 0);

    return (
        <div className={`d-flex flex-fill justify-content-between align-items-center ${large ? "flex-row" : "flex-column flex-lg-row"}`}>
            <div className="d-flex flex-row align-items-center gap-2">
                <div>
                    <img
                        className="img-primary w-100"
                        style={{ maxWidth: 30 }}
                        src={large || active ? stock.imagePath : stock.secondaryImagePath}
                        alt={stock.name}
                    />
                </div>
                <p className={large ? "d-block" : "d-none"}>{stock.name}</p>
            </div>
            <div className={`text-end ${large ? "" : "d-lg-block d-none"}`}>
                <p>
                    £
                    {price.toFixed(2)}
                </p>
                <Change value={value} />
            </div>
        </div>
    );
}

function TradeModal({ board, stock, mode }: { board: Board; stock: Stock; mode: "buy" | "sell" })
{
    const play = useMutation(api.trading.play);
    const { run, busy, error } = useAction();
    const [quantity, setQuantity] = useState(0);
    const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const held = board.player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0;
    const available = 100_000 - board.players.reduce((sum, player) => sum
      + (player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0), 0);
    const limit = mode === "buy" ? Math.min(available, price > 0 ? Math.floor(board.player.cash / price / 1000) * 1000 : 0) : held;
    const valid = quantity > 0 && quantity <= limit && price > 0;
    const label = mode === "buy" ? "Buy" : "Sell";

    return (
        <Modal id={`${mode}Modal`} title={`${label} ${stock.name}`}>
            <div className="modal-body d-flex flex-column gap-2">
                <StockPreview board={board} stock={stock} large />
                <h3 className="text-black">
                    {label}
                    {" "}
                    stocks
                </h3>
                <Alert message={error} />
                <form
                    id={`${mode}Stock`}
                    onSubmit={(event) =>
                    {
                        event.preventDefault();
                        void run(() => play({ code: board.game.code, expectedTurn: board.game.turn, stockKey: stock.key,
                            quantity: mode === "buy" ? quantity : -quantity }));
                    }}
                >
                    <div className="purchase-form flex-fill">
                        <h6 className="mb-0 header-amount-of-stocks">Amount of stocks</h6>
                        <h6 className="mb-0 header-value">Value</h6>
                        <div className="input-stock-group input-group mb-0">
                            <input
                                aria-label="Amount of stocks"
                                type="number"
                                step={1000}
                                min={0}
                                className="form-control input-stock"
                                value={quantity}
                                onChange={(event) =>
                                {
                                    setQuantity(Math.max(0, Math.floor(Number(event.target.value) / 1000) * 1000));
                                }}
                            />
                        </div>
                        <p className="equals d-flex justify-content-center align-items-center flex-fill">=</p>
                        <div className="input-cash-group input-group mb-0">
                            <span className="input-group-text text-black bg-white pe-1 border-end-0">£</span>
                            <input className="form-control input-cash border-start-0 ps-0" type="number" value={quantity * price} readOnly aria-label="Value" />
                        </div>
                        <div className="stock-btns d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-danger flex-fill"
                                onClick={() =>
                                {
                                    setQuantity(Math.max(0, quantity - 1000));
                                }}
                            >
                                -
                            </button>
                            <button
                                type="button"
                                className="btn btn-success flex-fill"
                                onClick={() =>
                                {
                                    setQuantity(Math.min(limit, quantity + 1000));
                                }}
                            >
                                +
                            </button>
                        </div>
                        <div className="cash-btns d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-danger flex-fill"
                                onClick={() =>
                                {
                                    setQuantity(Math.max(0, quantity - 1000));
                                }}
                            >
                                -
                            </button>
                            <button
                                type="button"
                                className="btn btn-success flex-fill"
                                onClick={() =>
                                {
                                    setQuantity(Math.min(limit, quantity + 1000));
                                }}
                            >
                                +
                            </button>
                        </div>
                        <div className="transaction-body">
                            <p>
                                Cash £
                                {money(board.player.cash + (mode === "buy" ? -1 : 1) * quantity * price)}
                            </p>
                            <p>
                                Shares held
                                {held + (mode === "buy" ? quantity : -quantity)}
                            </p>
                        </div>
                    </div>
                </form>
            </div>
            <div className="modal-footer d-flex flex-row">
                <button type="button" className="btn btn-secondary flex-fill" data-bs-dismiss="modal">Cancel</button>
                <button
                    className={`btn btn-${mode === "buy" ? "success" : "danger"} flex-fill`}
                    type="submit"
                    form={`${mode}Stock`}
                    disabled={busy || !valid}
                    data-bs-dismiss={valid ? "modal" : undefined}
                >
                    {label}
                </button>
            </div>
        </Modal>
    );
}

export function StockPanel({ board, stock }: { board: Board; stock: Stock })
{
    const { game, player, players, insights, stocks } = board;
    const price = game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const held = player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0;
    const ownInsights = insights.filter((insight) => insight.stockKey === stock.key);
    const value = ownInsights.reduce((sum, insight) => sum + insight.value, 0);
    const available = 100_000 - players.reduce((sum, seat) => sum
      + (seat.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0), 0);
    const myTurn = game.currentUserId === board.user._id;

    return (
        <>
            <div id="game-stock-info" className={`gap-3 flex-fill bg-white text-black rounded-bottom p-3 ${myTurn ? "" : "watching"}`}>
                <div id="stocks" className="rounded p-3 pb-5 d-flex flex-column gap-2 text-center" style={{ backgroundColor: "#EFEFEF" }}>
                    <StockPreview board={board} stock={stock} large />
                    <div>
                        <h4 className="text-black">
                            {held}
                            {" "}
                            Shares held
                        </h4>
                        <p>
                            £
                            {(held * price).toFixed(2)}
                            {" "}
                            stock evaluation
                        </p>
                    </div>
                </div>
                <div id="investors">
                    <h4 className="text-black">Investors</h4>
                    <div className="d-flex flex-row gap-2">
                        {players.filter((seat) => seat.holdings.some((item) =>
                            item.stockKey === stock.key && item.quantity > 0)).map((seat) => (
                            <div className="d-flex flex-column align-items-center" key={seat._id}>
                                <img className="rounded" width={56} src={seat.profileRoot} alt={seat.name} />
                                <p>{seat.holdings.find((item) => item.stockKey === stock.key)?.quantity}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div id="insights" className="d-grid gap-2" style={{ gridTemplateRows: "auto 1fr" }}>
                    <div className="d-flex justify-content-between">
                        <h4 className="text-black">Your Insights</h4>
                        <Change value={value} button />
                    </div>
                    <Insights insights={ownInsights} stocks={stocks} />
                </div>
                <div id="stock-info" className="d-flex flex-column gap-2">
                    <h4 className="text-black">Info</h4>
                    <div className="d-flex flex-column d-sm-grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                        {[[stock.variation, "Volitility"], ["N/A", "Director"], [available, "Shares available"]].map(([number, title]) => (
                            <div className="card flex-fill" key={title}>
                                <div className="card-body text-center">
                                    <p>{number}</p>
                                    <p className="text-secondary">{title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {myTurn && (
                    <>
                        <button id="buy-button" className="btn btn-success" data-bs-toggle="modal" data-bs-target="#buyModal">Buy</button>
                        <button id="sell-button" className="btn btn-danger" data-bs-toggle="modal" data-bs-target="#sellModal">Sell</button>
                    </>
                )}
            </div>
            <TradeModal key={`${stock.key}-buy`} board={board} stock={stock} mode="buy" />
            <TradeModal key={`${stock.key}-sell`} board={board} stock={stock} mode="sell" />
        </>
    );
}
