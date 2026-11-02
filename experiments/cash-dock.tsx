import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
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
    imageRoot: player.profileRoot,
    message: ["bought 10000 shares in UB", "sold 5000 shares in Thames", "bought 2000 shares in Natwest"][index],
}));
const client = new ConvexReactClient("https://preview.convex.cloud");

createRoot(document.querySelector("#root")!).render(
    <ConvexProvider client={client}>
        <BrowserRouter><main className="position-relative overflow-x-hidden d-flex flex-column justify-content-center"><Playing board={board} hasChanceCards={new URLSearchParams(location.search).get("cards") !== "none"} /></main></BrowserRouter>
    </ConvexProvider>,
);
