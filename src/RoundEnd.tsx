import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Alert, money, useAction } from "./shared";
import { revealStocks } from "./reveals";
import { RoundReveal } from "./RoundReveal";
import { HoldStock } from "./HoldStock";
import type { Board } from "./types";

export function RoundEnd({ board }: { board: Board })
{
    const { game, stocks, insights, players } = board;
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
    const host = game.hostId === board.user._id;

    useEffect(() =>
    {
        if (unresolved || index >= visible.length)
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
    }, [index, visible.length, unresolved, step]);

    if (game.status === "finished")
    {
        return (
            <div className="container card card-green p-4 text-center">
                <h1>Game finished</h1>
                <h2>
                    {[...players].toSorted((a, b) => b.netWorth - a.netWorth)[0]?.name}
                    {" "}
                    wins!
                </h2>
                {players.map((player) => (
                    <div className="d-flex justify-content-between p-3" key={player._id}>
                        <span>
                            {player.ranking}
                            .
                            {" "}
                            {player.name}
                        </span>
                        <span>
                            £
                            {money(player.netWorth)}
                        </span>
                    </div>
                ))}
                <Link className="btn btn-primary" to="/">Go Back</Link>
            </div>
        );
    }

    return (
        <>
            <div className="gap-3 p-4 d-grid" style={{ height: "100vh", maxHeight: "-webkit-fill-available", gridTemplateRows: "auto 1fr auto auto" }}>
                <div className="d-flex flex-column align-items-center justify-content-center">
                    <h1>End of round</h1>
                    {special && <h2>Additional insights</h2>}
                </div>
                <div id="insight-view" className="card card-green p-4 rounded border border-5 border-white">
                    {unresolved ? <HoldStock board={board} insight={unresolved} /> : (activeStock
                        ? <RoundReveal board={board} stock={activeStock} insights={visible} index={index} />
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
                                    {(game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div id="player-view" className="card card-green p-4 rounded d-flex flex-sm-row flex-column justify-content-between align-items-center">
                    <h2>Net Worth:</h2>
                    <div className="d-flex w-100 gap-5 flex-sm-row flex-column justify-content-center">
                        {players.map((player) => (
                            <div className="d-flex flex-column align-items-center" key={player._id}>
                                <img height={80} width={80} className="rounded" src={player.profileRoot} alt={player.name} />
                                <span>
                                    £
                                    {money(player.netWorth)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div id="next-step-wrapper" className="position-absolute bottom-0 end-0 p-3" style={{ animation: "none" }}>
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
                ) : <p>Waiting for the game creator to continue.</p>) : (
                    <button
                        className="btn btn-primary d-flex flex-row gap-2 align-items-center"
                        disabled={Boolean(unresolved) || index < visible.length}
                        onClick={() =>
                        {
                            setStep((current) => current + 1);
                            setIndex(0);
                        }}
                    >
                        {step < groups.length - 1 ? `Next: ${groups[step + 1].name}` : "View round summary"}
                        {" →"}
                    </button>
                )}
            </div>
        </>
    );
}
