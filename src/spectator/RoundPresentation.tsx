import { nextRoundLabel } from "../../shared/packs";
import { pendingSuspensions } from "../../shared/suspensions";
import { ShareSuspended } from "../ShareSuspended";
import { useAction } from "../shared";
import { cashStockKey } from "../../shared/chance-cards";
import { useEffect, useState } from "react";
import type { Board } from "./types";
import { websiteBoard } from "./presentation";
import { revealGroups } from "../reveals";
import { roundProgress } from "../round-preview";
import { RoundReveal } from "../RoundReveal";
import { RoundOverview } from "../RoundOverview";
import { useRevealReady } from "../use-reveal-ready";
import { RoundWealth } from "../RoundWealth";

function unavailableAction()
{
    return Promise.reject(new Error("The display is not connected to this game"));
}

export function RoundPresentation({ snapshot, onNext, busy, error, onBack, overview = false,
    onBeginSuspensions = unavailableAction, onSkipSuspension = unavailableAction }: {
    snapshot: Board; onNext: () => void; busy: boolean;
    error: string; onBack: () => void; overview?: boolean;
    onBeginSuspensions?: (arguments_: { code: string; expectedPeriod: number }) => Promise<unknown>;
    onSkipSuspension?: (arguments_: { code: string; expectedPeriod: number;
        insightId: NonNullable<Board["reveal"]>["insights"][number]["_id"] }) => Promise<unknown>;
})
{
    const board = websiteBoard(snapshot);
    const beginSuspensions = onBeginSuspensions;
    const skipSuspension = onSkipSuspension;
    const decision = useAction();
    const groups = revealGroups(board.stocks, board.insights);
    const [step, setStep] = useState(overview ? groups.length : 0);
    const [index, setIndex] = useState(0);
    const stock = groups[step];
    const cash = stock?.key === cashStockKey;
    const visible = board.insights.filter((insight) => insight.stockKey === stock?.key);
    const unresolved = stock?.name === "Hold Stock Price" ? visible.find((insight) => !insight.resolved) : undefined;
    const owner = board.players.find((player) => player._id === unresolved?.playerId);
    const suspensions = pendingSuspensions(board.game.currentPeriod, board.players, board.insights);
    const reviewed = step >= groups.length || board.game.suspensionPeriod === board.game.currentPeriod;
    const lastPlay = snapshot.feed.find((item) => item.period === snapshot.game.currentPeriod
      && item.colour !== "grey" && (item.quantity || item.cashBonus || item.message === "passed their go"));
    const ready = useRevealReady(lastPlay?.at);
    const pendingHolds = board.insights.some((insight) => !insight.resolved
      && board.stocks.find((item) => item.key === insight.stockKey)?.name === "Hold Stock Price");
    const { preview, wealth } = roundProgress(board, reviewed ? groups.length : step, index);

    const afterCash = suspensions.length > 0 ? "Next: Share Suspended" : "Show round summary";
    const continuation = step < groups.length - 1 ? `Next: ${groups[step + 1].name}` : afterCash;

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

    if (reviewed && suspensions[0])
    {
        const card = suspensions[0];

        return (
            <main className="website-presentation">
                <div className="round-end suspension-round p-4">
                    <ShareSuspended
                        key={card._id}
                        board={board}
                        card={card}
                        spectator
                        busy={decision.busy}
                        error={decision.error}
                        onDecision={() => decision.run(async () =>
                        {
                            if (board.game.suspensionPeriod !== board.game.currentPeriod)
                            {
                                await beginSuspensions({ code: board.game.code,
                                    expectedPeriod: board.game.currentPeriod });
                            }

                            await skipSuspension({ code: board.game.code, expectedPeriod: board.game.currentPeriod,
                                insightId: card._id });
                        })}
                    />
                </div>
            </main>
        );
    }

    return (
        <main className="website-presentation">
            <div className="round-end gap-3 p-4 d-grid">
                <div className="d-flex flex-column align-items-center justify-content-center">
                    <h1>End of round</h1>
                    {stock && !stock.display && !cash && <h2>Additional insights</h2>}
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
                    {(error || decision.error) && <p className="error" role="alert">{error || decision.error}</p>}
                    {reviewed ? (
                        <>
                            {pendingHolds && <p>Waiting for players to resolve their hold-stock insights.</p>}
                            <button className="btn btn-primary" disabled={busy || pendingHolds} onClick={onNext}>
                                {busy ? "Starting…" : nextRoundLabel(board.game)}
                                {" "}
                                →
                            </button>
                        </>
                    )
                        : (
                            <button
                                className="btn btn-primary"
                                disabled={Boolean(unresolved) || decision.busy}
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
                                            void decision.run(async () =>
                                            {
                                                await beginSuspensions({ code: board.game.code,
                                                    expectedPeriod: board.game.currentPeriod });
                                                setStep((old) => old + 1);
                                                setIndex(0);
                                            });
                                        }
                                        else
                                        {
                                            setStep((old) => old + 1);
                                            setIndex(0);
                                        }
                                    }
                                }}
                            >
                                {index < visible.length ? (cash ? "Skip to cash summary" : "Skip to stock summary") : continuation}
                                {" "}
                                →
                            </button>
                        )}
                </div>
            </div>
        </main>
    );
}
