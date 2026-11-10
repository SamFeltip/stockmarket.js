import "./round-desktop.css";
import { pendingSuspensions } from "../shared/suspensions";
import { ShareSuspended } from "./ShareSuspended";
import { cashStockKey } from "../shared/chance-cards";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Alert, useAction } from "./shared";
import { revealGroups } from "./reveals";
import { GameResults } from "./GameResults";
import { RoundOverview } from "./RoundOverview";
import { RoundWealth } from "./RoundWealth";
import { roundProgress } from "./round-preview";
import { RoundReveal } from "./RoundReveal";
import { useRevealReady } from "./use-reveal-ready";
import { HoldStock } from "./HoldStock";
import type { Board } from "./types";

export function RoundEnd({ board, onBeginSuspensions, onSuspensionDecision }: {
    board: Board; onBeginSuspensions?: () => Promise<void>;
    onSuspensionDecision?: (insightId: Board["insights"][number]["_id"], stockKey?: number) => Promise<void>;
})
{
    const { game, stocks, insights } = board;
    const next = useMutation(api.rounds.next);
    const beginSuspensions = useMutation(api.rounds.beginSuspensions);
    const suspendShare = useMutation(api.rounds.suspendShare);
    const { run, busy, error } = useAction();
    const [step, setStep] = useState(0);
    const [index, setIndex] = useState(0);
    const groups = revealGroups(stocks, insights);
    const activeStock = groups[step];
    const cash = activeStock?.key === cashStockKey;
    const special = Boolean(activeStock && !activeStock.display && !cash);
    const visible = insights.filter((insight) => insight.stockKey === activeStock?.key);
    const holds = activeStock?.name === "Hold Stock Price" ? visible.filter((insight) => !insight.resolved) : [];
    const unresolved = holds.find((insight) => insight.playerId === board.player._id) ?? holds[0];
    const pendingHolds = insights.some((insight) => !insight.resolved
      && stocks.find((stock) => stock.key === insight.stockKey)?.name === "Hold Stock Price");
    const suspensions = pendingSuspensions(game.currentPeriod, board.players, insights);
    const reviewed = step >= groups.length || game.suspensionPeriod === game.currentPeriod;
    const host = game.hostId === board.user._id && !game.tvControlled && !game.spectatorControlled;
    const lastPlay = board.feed.find((item) => item.period === game.currentPeriod
      && item.colour !== "grey" && (item.quantity || item.cashBonus || item.message === "passed their go"));
    const ready = useRevealReady(lastPlay?._creationTime);
    const { preview, wealth } = roundProgress(board, reviewed ? groups.length : step, index);

    const afterCash = suspensions.length > 0 ? "Next: Share Suspended" : "Show round summary";
    const continuation = step < groups.length - 1 ? `Next: ${groups[step + 1].name}` : afterCash;

    function beginSuspensionPhase()
    {
        return onBeginSuspensions ? onBeginSuspensions()
            : beginSuspensions({ code: game.code, expectedPeriod: game.currentPeriod });
    }

    useEffect(() =>
    {
        if (!ready || reviewed || unresolved || index >= visible.length)
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
    }, [index, visible.length, unresolved, step, ready, reviewed]);

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

    if (reviewed && suspensions[0])
    {
        const card = suspensions[0];

        return (
            <div className="round-end suspension-round p-4">
                <ShareSuspended
                    key={card._id}
                    board={board}
                    card={card}
                    own={card.playerId === board.player._id}
                    busy={busy}
                    error={error}
                    onDecision={(stockKey) => run(async () =>
                    {
                        if (game.suspensionPeriod !== game.currentPeriod)
                        {
                            await beginSuspensionPhase();
                        }

                        await (onSuspensionDecision
                            ? onSuspensionDecision(card._id, stockKey)
                            : suspendShare({ code: game.code, expectedPeriod: game.currentPeriod,
                                insightId: card._id, stockKey }));
                    })}
                />
            </div>
        );
    }

    return (
        <>
            <div className="round-end player-round-end gap-3 p-4 d-grid">
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
                    ) : (
                        <p>
                            {game.tvControlled ? "Use the TV remote to start the next period." : (game.spectatorControlled
                                ? "Use the spectator display to start the next period." : "Waiting for the game creator to continue.")}
                        </p>
                    )) : (
                        <button
                            className="btn btn-primary d-flex flex-row gap-2 align-items-center"
                            disabled={Boolean(unresolved) || busy}
                            onClick={() =>
                            {
                                if (index < visible.length)
                                {
                                    setIndex(visible.length);
                                }
                                else
                                {
                                    if (step === groups.length - 1 && suspensions.length > 0)
                                    {
                                        void run(async () =>
                                        {
                                            await beginSuspensionPhase();
                                            setStep((current) => current + 1);
                                            setIndex(0);
                                        });
                                    }
                                    else
                                    {
                                        setStep((current) => current + 1);
                                        setIndex(0);
                                    }
                                }
                            }}
                        >
                            {index < visible.length ? (cash ? "Skip to cash summary" : "Skip to stock summary")
                                : continuation}
                            {" →"}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
