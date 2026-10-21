import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Alert, useAction } from "./shared";
import { revealStocks } from "./reveals";
import { GameResults } from "./GameResults";
import { RoundOverview } from "./RoundOverview";
import { RoundWealth } from "./RoundWealth";
import { roundProgress } from "./round-preview";
import { RoundReveal } from "./RoundReveal";
import { useRevealReady } from "./use-reveal-ready";
import { HoldStock } from "./HoldStock";
import type { Board } from "./types";

export function RoundEnd({ board }: { board: Board })
{
    const { game, stocks, insights } = board;
    const next = useMutation(api.rounds.next);
    const { run, busy, error } = useAction();
    const [step, setStep] = useState(0);
    const [index, setIndex] = useState(0);
    const groups = revealStocks(stocks, insights);
    const activeStock = groups[step];
    const special = Boolean(activeStock && !activeStock.display);
    const visible = insights.filter((insight) => insight.stockKey === activeStock?.key);
    const holds = activeStock?.name === "Hold Stock Price" ? visible.filter((insight) => !insight.resolved) : [];
    const unresolved = holds.find((insight) => insight.playerId === board.player._id) ?? holds[0];
    const pendingHolds = insights.some((insight) => !insight.resolved
      && stocks.find((stock) => stock.key === insight.stockKey)?.name === "Hold Stock Price");
    const reviewed = step >= groups.length;
    const host = game.hostId === board.user._id && !game.tvControlled;
    const lastPlay = board.feed.find((item) => item.period === game.currentPeriod
      && item.colour !== "grey" && (item.quantity || item.message === "passed their go"));
    const ready = useRevealReady(lastPlay?._creationTime);
    const { preview, wealth } = roundProgress(board, step, index);

    useEffect(() =>
    {
        if (!ready || unresolved || index >= visible.length)
        {
            return;
        }

        const timer = setTimeout(() =>
        {
            setIndex((current) => current + 1);
        }, 2500);

        return () =>
        {
            clearTimeout(timer);
        };
    }, [index, visible.length, unresolved, step, ready]);

    if (game.status === "finished")
    {
        return <GameResults board={board} />;
    }

    if (!ready)
    {
        return (
            <div className="round-transition text-center">
                <h1>End of round</h1>
                <p>Revealing insights shortly…</p>
            </div>
        );
    }

    return (
        <>
            <div className="round-end gap-3 p-4 d-grid">
                <div className="d-flex flex-column align-items-center justify-content-center">
                    <h1>End of round</h1>
                    {special && <h2>Additional insights</h2>}
                </div>
                {reviewed ? <RoundOverview before={board} after={preview} /> : (
                    <>
                        <div id="insight-view" className="card card-green p-4 rounded border border-5 border-white">
                            {unresolved ? <HoldStock board={board} insight={unresolved} /> : (activeStock
                                ? (
                                    <RoundReveal
                                        board={board}
                                        preview={preview}
                                        stock={activeStock}
                                        insights={visible}
                                        index={index}
                                    />
                                )
                                : <p className="text-center">All insights revealed</p>)}
                        </div>
                        <div id="stock-view" className="card card-green px-5 py-4 rounded border-5 border-white flex-sm-row align-items-center">
                            <h2>Stock Values:</h2>
                            <div className="gap-3 flex-fill d-flex flex-nowrap flex-column flex-sm-row justify-content-between align-items-center">
                                {stocks.filter((stock) => stock.display).map((stock) => (
                                    <div className="game-stock d-flex flex-column align-items-center" key={stock.key}>
                                        <img className="w-100 p-3 object-fit-contain" style={{ maxHeight: 100 }} src={stock.secondaryImagePath} alt={stock.name} />
                                        <div>
                                            £
                                            {(preview.game.prices.find((price) =>
                                                price.stockKey === stock.key)?.value ?? 0).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <RoundWealth players={wealth.players} stock={activeStock} />
                    </>
                )}
                <div id="next-step-wrapper" className="round-navigation p-3" style={{ animation: "none" }}>
                    <Alert message={error} />
                    {reviewed ? (host ? (
                        <>
                            {pendingHolds && <p>Waiting for players to resolve their hold-stock insights.</p>}
                            <button
                                className="btn btn-primary"
                                disabled={busy || pendingHolds}
                                onClick={() =>
                                {
                                    void run(() => next({ code: game.code, expectedPeriod: game.currentPeriod }));
                                }}
                            >
                                {game.currentPeriod >= game.periodCount ? "Finish Game" : "Next Period"}
                                {" →"}
                            </button>
                        </>
                    ) : <p>{game.tvControlled ? "Use the TV remote to start the next period." : "Waiting for the game creator to continue."}</p>) : (
                        <button
                            className="btn btn-primary d-flex flex-row gap-2 align-items-center"
                            disabled={Boolean(unresolved)}
                            onClick={() =>
                            {
                                if (index < visible.length)
                                {
                                    setIndex(visible.length);
                                }
                                else
                                {
                                    setStep((current) => current + 1);
                                    setIndex(0);
                                }
                            }}
                        >
                            {index < visible.length ? "Skip to stock summary"
                                : (step < groups.length - 1 ? `Next: ${groups[step + 1].name}` : "View round summary")}
                            {" →"}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
