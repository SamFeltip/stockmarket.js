import { useEffect, useState } from "react";
import type { Board } from "./types";
import { websiteBoard } from "./presentation";
import { revealStocks } from "../reveals";
import { roundProgress } from "../round-preview";
import { RoundReveal } from "../RoundReveal";
import { RoundOverview } from "../RoundOverview";
import { useRevealReady } from "../use-reveal-ready";
import { RoundWealth } from "../RoundWealth";

export function RoundPresentation({ snapshot, canAdvance, onNext, busy, error, onBack, overview = false }: {
    snapshot: Board; canAdvance: boolean; onNext: () => void; busy: boolean;
    error: string; onBack: () => void; overview?: boolean;
})
{
    const board = websiteBoard(snapshot);
    const groups = revealStocks(board.stocks, board.insights);
    const [step, setStep] = useState(overview ? groups.length : 0);
    const [index, setIndex] = useState(0);
    const stock = groups[step];
    const visible = board.insights.filter((insight) => insight.stockKey === stock?.key);
    const unresolved = stock?.name === "Hold Stock Price" ? visible.find((insight) => !insight.resolved) : undefined;
    const owner = board.players.find((player) => player._id === unresolved?.playerId);
    const reviewed = step >= groups.length;
    const lastPlay = snapshot.feed.find((item) => item.period === snapshot.game.currentPeriod
      && item.colour !== "grey" && (item.quantity || item.message === "passed their go"));
    const ready = useRevealReady(lastPlay?.at);
    const pendingHolds = board.insights.some((insight) => !insight.resolved
      && board.stocks.find((item) => item.key === insight.stockKey)?.name === "Hold Stock Price");
    const { preview, wealth } = roundProgress(board, step, index);

    useEffect(() =>
    {
        if (!ready || unresolved || index >= visible.length || reviewed)
        {
            return;
        }

        const timer = globalThis.setTimeout(() => setIndex((current) => current + 1), 2500);

        return () => globalThis.clearTimeout(timer);
    }, [index, visible.length, unresolved, step, reviewed, ready]);

    if (!ready)
    {
        return (
            <main className="center">
                <h1>End of round</h1>
                <p>Revealing insights shortly…</p>
            </main>
        );
    }

    return (
        <main className="website-presentation">
            <div className="round-end gap-3 p-4 d-grid">
                <div className="d-flex flex-column align-items-center justify-content-center">
                    <h1>End of round</h1>
                    {stock && !stock.display && <h2>Additional insights</h2>}
                </div>
                {reviewed ? <RoundOverview before={board} after={preview} /> : (
                    <>
                        <div id="insight-view" className="card card-green p-4 rounded border border-5 border-white">
                            {unresolved ? (
                                <div className="bg-white text-black rounded p-4">
                                    <h2 className="text-black">
                                        {`Waiting for ${owner?.name ?? "the player"} to suspend a share`}
                                    </h2>
                                    <div className="d-grid gap-2 hold-stock-options">
                                        {board.stocks.filter((item) => item.display).map((item) => (
                                            <div className="btn btn-outline-secondary" key={item.key}>
                                                <img src={item.imagePath} alt={item.name} />
                                                <p>
                                                    £
                                                    {board.game.prices.find((price) =>
                                                        price.stockKey === item.key)?.value.toFixed(2)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-3">They choose on their phone.</p>
                                </div>
                            ) : (stock ? (
                                <RoundReveal
                                    board={board}
                                    preview={preview}
                                    stock={stock}
                                    insights={visible}
                                    index={index}
                                />
                            ) : null)}
                        </div>
                        <div
                            id="stock-view"
                            className="card card-green px-5 py-4 rounded border-5 border-white flex-sm-row align-items-center"
                        >
                            <h2>Stock Values:</h2>
                            <div className="gap-3 flex-fill d-flex flex-nowrap flex-column flex-sm-row justify-content-between align-items-center">
                                {board.stocks.filter((item) => item.display).map((item) => (
                                    <div className="game-stock d-flex flex-column align-items-center" key={item.key}>
                                        <img className="w-100 p-3 object-fit-contain" src={item.secondaryImagePath} alt={item.name} />
                                        <div>
                                            £
                                            {(preview.game.prices.find((price) =>
                                                price.stockKey === item.key)?.value ?? 0).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <RoundWealth players={wealth.players} stock={stock} />
                    </>
                )}
                <div id="next-step-wrapper" className="round-navigation p-3 d-flex gap-3 align-items-center" style={{ animation: "none" }}>
                    <button className="btn btn-secondary" onClick={onBack}>Back</button>
                    {error && <p className="error" role="alert">{error}</p>}
                    {reviewed ? (canAdvance ? (
                        <>
                            {pendingHolds && <p>Waiting for players to resolve their hold-stock insights.</p>}
                            <button className="btn btn-primary" disabled={busy || pendingHolds} onClick={onNext}>
                                {busy ? "Starting…" : (board.game.currentPeriod >= board.game.periodCount ? "Finish Game" : "Next Period")}
                                {" "}
                                →
                            </button>
                        </>
                    ) : <p>{snapshot.game.tvControlled ? "Waiting for the controlling TV to continue." : "Waiting for the game creator to continue."}</p>)
                        : (
                            <button
                                className="btn btn-primary"
                                disabled={Boolean(unresolved)}
                                onClick={() =>
                                {
                                    if (index < visible.length)
                                    {
                                        setIndex(visible.length);
                                    }
                                    else
                                    {
                                        setStep((old) => old + 1);
                                        setIndex(0);
                                    }
                                }}
                            >
                                {index < visible.length ? "Skip to stock summary" : (step < groups.length - 1 ? `Next: ${groups[step + 1].name}` : "View round summary")}
                                {" "}
                                →
                            </button>
                        )}
                </div>
            </div>
        </main>
    );
}
