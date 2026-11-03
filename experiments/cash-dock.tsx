import { configureSuspensionDemo } from "./suspension-demo";
import { ShareSuspended } from "../src/ShareSuspended";
import { RoundOverview } from "../src/RoundOverview";
import { previewRound } from "../src/round-preview";
import { pendingSuspensions } from "../shared/suspensions";
import { useState } from "react";
import { PlayAnimation } from "../src/PlayAnimation";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import { companyRoles } from "../shared/company-roles";
import { specialDeck, cashStock, governmentLoanAmount } from "../shared/chance-cards";
import { RoundEnd } from "../src/RoundEnd";
import { Playing } from "../src/Playing";
import raw from "./cash-dock-board.json";
import "../src/patch.css";
import type { Board } from "../src/types";
import { setupStandaloneSafeArea } from "../src/standalone-safe-area";

const cleanupSafeArea = setupStandaloneSafeArea();

import.meta.hot?.dispose(cleanupSafeArea);

// An offline fixture: no authentication, backend writes or real game required.
const board = structuredClone(raw) as unknown as Board;

board.game.status = "playing";
board.game.code = "DEMO";
board.game.currentPeriod = 2;
board.game.turn = 8;

for (const [index, player] of board.players.entries())
{
    player.name = ["Sam", "Bob", "Pat", "Lee"][index];
    player.profileRoot = `/static/imgs/${index + 1}profile.png`;
}

for (const player of board.players)
{
    player.roles = board.stocks.flatMap((stock) => companyRoles(board.players, stock.key)
        .filter((entry) => entry.playerId === player._id)
        .map((entry) => ({ stockKey: stock.key, role: entry.role })));
}

board.user.name = "Sam";
board.player.cash = 42_500;
board.players[0].cash = board.player.cash;
board.insights = board.insights.filter((insight) => insight.playerId === board.player._id);
board.stocks.sort((left, right) => Number(right.key === 8) - Number(left.key === 8));
board.game.priceHistory = [0, 1, 2].map((period) => ({
    period,
    prices: board.game.prices.map((price) => ({ ...price, value: price.value * [0.8, 1.12, 1][period] })),
}));
board.feed = board.players.slice(1, 4).map((player, index) => ({
    ...board.feed[0],
    _id: `${board.feed[0]._id}${index}` as Board["feed"][number]["_id"],
    title: player.name,
    colour: "",
    imageRoot: player.profileRoot,
    message: ["bought 10000 shares in UB", "sold 5000 shares in Thames", "bought 2000 shares in Natwest"][index],
}));
const parameters = new URLSearchParams(location.search);
const requestedCash = Number(parameters.get("cash") ?? 20);
const cashPercent = [0, 10, 20, -10, -20].includes(requestedCash) ? requestedCash : 0;

board.stocks.push({ ...cashStock, _id: "cash" as Board["stocks"][number]["_id"], _creationTime: 0 });
board.insights = board.insights.map((card) => ({ ...card, period: board.game.currentPeriod }));
const sample = board.insights[0];

board.insights.push(...Array.from({ length: Math.abs(cashPercent) / 10 }, (_, index) => ({
    ...sample, _id: `cash-insight-${index}` as typeof sample._id, stockKey: cashStock.key,
    value: Math.sign(cashPercent) * 0.1, description: `Cash ${cashPercent > 0 ? "+" : "−"}10%`,
})));

if (parameters.get("cards") !== "none")
{
    board.insights.push(...specialDeck().filter((card) => card.chanceKind && card.id.endsWith(":0"))
        .map((card) => ({ ...sample, _id: card.id.replaceAll(":", "-") as typeof sample._id,
            stockKey: card.stockKey, chanceKind: card.chanceKind, value: 0, description: card.description })));
}

const roundView = parameters.get("view") === "round";
if (roundView)
{
    board.game.status = "closed";
    board.game.spectatorControlled = true;
}

board.debentureOffers = [];

if (parameters.get("debenture") === "1")
{
    board.debentureOffers = [
        { stockKey: 8, quantity: 20_000, unitPrice: 2.5, amount: 50_000 },
        { stockKey: 10, quantity: 2000, unitPrice: 5.5, amount: 11_000 },
    ].map((offer) => ({ ...offer, claimUntilPeriod: board.game.currentPeriod + 1, unavailableReason: null }));

    for (const offer of board.debentureOffers)
    {
        board.game.prices = board.game.prices.map((price) => price.stockKey === offer.stockKey
            ? { ...price, value: 0 } : price);
        board.game.priceHistory = board.game.priceHistory?.map((snapshot) => ({ ...snapshot,
            prices: snapshot.prices.map((price) => price.stockKey === offer.stockKey
                ? { ...price, value: snapshot.period < board.game.currentPeriod ? offer.unitPrice! : 0 } : price) }));
        board.player.holdings = board.player.holdings.filter((holding) => holding.stockKey !== offer.stockKey)
            .concat({ stockKey: offer.stockKey, quantity: offer.quantity });
    }

    board.players[0].holdings = board.player.holdings;
    board.players[0].netWorth = board.player.cash;
    board.insights = board.insights.map((card) => card.chanceKind === "debenture"
        ? { ...card, period: board.game.currentPeriod - 1 } : card);

    for (const player of board.players)
    {
        player.roles = board.stocks.flatMap((stock) => companyRoles(board.players, stock.key)
            .filter((entry) => entry.playerId === player._id)
            .map((entry) => ({ stockKey: stock.key, role: entry.role })));
    }
}

const suspensionDemo = new URLSearchParams(location.search).get("suspend");

configureSuspensionDemo(board, suspensionDemo);

const client = new ConvexReactClient("https://preview.convex.cloud");

function CashDockDemo()
{
    const [demoBoard, setDemoBoard] = useState(board);

    function activateLoan(insightId: Board["insights"][number]["_id"])
    {
        const card = demoBoard.insights.find((item) => item._id === insightId);
        if (!card || card.used || card.chanceKind !== "loan"
          || demoBoard.game.currentPlayerId !== demoBoard.player._id || demoBoard.game.status !== "playing")
        {
            return Promise.reject(new Error("This card cannot be used"));
        }

        setDemoBoard((current) =>
        {
            const player = { ...current.player, cash: current.player.cash + governmentLoanAmount };
            const next = current.players[(current.players.findIndex((seat) => seat._id === player._id) + 1)
              % current.players.length];
            const turn = current.game.turn + 1;

            return { ...current, player,
                players: current.players.map((seat) => seat._id === player._id
                    ? { ...seat, cash: player.cash, netWorth: seat.netWorth + governmentLoanAmount } : seat),
                insights: current.insights.map((item) => item._id === insightId ? { ...item, used: true } : item),
                game: { ...current.game, turn, currentPlayerId: next._id, currentUserId: next.userId,
                    status: turn >= current.players.length * 3 ? "closed" : "playing" },
                feed: [{ _id: `loan-${Date.now()}` as Board["feed"][number]["_id"], _creationTime: Date.now(),
                    gameId: current.game._id, period: current.game.currentPeriod, title: current.user.name,
                    message: "received government bonus", imageRoot: current.user.profileRoot, colour: "",
                    cashBonus: governmentLoanAmount }, ...current.feed],
            };
        });

        return Promise.resolve();
    }

    function redeemDebenture(insightId: Board["insights"][number]["_id"], stockKey: number)
    {
        const card = demoBoard.insights.find((item) => item._id === insightId);
        const offer = demoBoard.debentureOffers.find((item) => item.stockKey === stockKey);
        if (!card || card.used || card.chanceKind !== "debenture" || !offer || offer.unavailableReason
          || offer.amount === null || demoBoard.game.currentPlayerId !== demoBoard.player._id)
        {
            return Promise.reject(new Error("This claim cannot be used"));
        }

        const amount = offer.amount;

        setDemoBoard((current) =>
        {
            const player = { ...current.player, cash: current.player.cash + amount,
                holdings: current.player.holdings.map((holding) => holding.stockKey === stockKey
                    ? { ...holding, quantity: 0 } : holding) };
            const next = current.players[(current.players.findIndex((seat) => seat._id === player._id) + 1)
              % current.players.length];
            const turn = current.game.turn + 1;

            return { ...current, player,
                players: current.players.map((seat) => seat._id === player._id
                    ? { ...seat, cash: player.cash, holdings: player.holdings,
                        netWorth: seat.netWorth + amount } : seat),
                insights: current.insights.map((item) => item._id === insightId ? { ...item, used: true } : item),
                debentureOffers: current.debentureOffers.filter((item) => item.stockKey !== stockKey),
                game: { ...current.game, turn, currentPlayerId: next._id, currentUserId: next.userId,
                    status: turn >= current.players.length * 3 ? "closed" : "playing" },
                feed: [{ _id: `debenture-${Date.now()}` as Board["feed"][number]["_id"], _creationTime: Date.now(),
                    gameId: current.game._id, period: current.game.currentPeriod, title: current.user.name,
                    message: `Debenture sold at £${amount.toLocaleString("en-GB")}`, imageRoot: current.user.profileRoot,
                    colour: "", quantity: -offer.quantity, stockKey, debenturePayout: amount }, ...current.feed],
            };
        });

        return Promise.resolve();
    }

    function beginSuspensions()
    {
        setDemoBoard((current) => ({ ...current, game: { ...current.game,
            suspensionPeriod: current.game.currentPeriod } }));

        return Promise.resolve();
    }

    function suspendShare(insightId: Board["insights"][number]["_id"], stockKey?: number)
    {
        setDemoBoard((current) => ({ ...current,
            insights: current.insights.map((card) => card._id === insightId ? { ...card, used: true,
                resolved: true } : card),
            game: { ...current.game, suspended: stockKey === undefined ? current.game.suspended
                : [...new Set([...current.game.suspended, stockKey])] },
        }));

        return Promise.resolve();
    }

    if (suspensionDemo === "spectator")
    {
        const active = pendingSuspensions(demoBoard.game.currentPeriod, demoBoard.players, demoBoard.insights)[0];

        return (
            <main className="website-presentation">
                <div className="round-end suspension-round p-4">
                    {active ? (
                        <ShareSuspended
                            key={active._id}
                            board={demoBoard}
                            card={active}
                            spectator
                            onDecision={async () =>
                            {
                                await suspendShare(active._id);

                                return true;
                            }}
                        />
                    )
                        : (
                            <RoundOverview
                                before={demoBoard}
                                after={previewRound(demoBoard, demoBoard.insights,
                                    demoBoard.stocks.map((stock) => stock.key))}
                            />
                        )}
                </div>
            </main>
        );
    }

    return (
        <main className="position-relative overflow-x-hidden d-flex flex-column justify-content-center">
            {demoBoard.game.status === "playing" ? <Playing board={demoBoard} onActivateLoan={activateLoan} onRedeemDebenture={redeemDebenture} />
                : (
                    <RoundEnd
                        board={demoBoard}
                        onBeginSuspensions={beginSuspensions}
                        onSuspensionDecision={suspendShare}
                    />
                )}
            <PlayAnimation board={demoBoard} />
        </main>
    );
}

createRoot(document.querySelector("#root")!).render(
    <ConvexProvider client={client}>
        <BrowserRouter><CashDockDemo /></BrowserRouter>
    </ConvexProvider>,
);
