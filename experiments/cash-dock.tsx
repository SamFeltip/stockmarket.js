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

// An offline fixture: no authentication, backend writes or real game required.
const board = raw as unknown as Board;

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

    return (
        <main className="position-relative overflow-x-hidden d-flex flex-column justify-content-center">
            {demoBoard.game.status === "playing" ? <Playing board={demoBoard} onActivateLoan={activateLoan} />
                : <RoundEnd board={demoBoard} />}
            <PlayAnimation board={demoBoard} />
        </main>
    );
}

createRoot(document.querySelector("#root")!).render(
    <ConvexProvider client={client}>
        <BrowserRouter><CashDockDemo /></BrowserRouter>
    </ConvexProvider>,
);
