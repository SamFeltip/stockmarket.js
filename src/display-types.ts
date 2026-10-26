import type { Board as PlayerBoard } from "./types";

export type Stock = Pick<PlayerBoard["stocks"][number], "key" | "name" | "display" | "imagePath" | "secondaryImagePath">;

export type Insight = Pick<PlayerBoard["insights"][number], "_id" | "playerId" | "stockKey" | "value" | "description" | "resolved">;

export type Player = Pick<PlayerBoard["players"][number], "_id" | "name" | "profileRoot" | "cash" | "holdings" | "netWorth" | "ranking">;

export interface Board {
    game: Pick<PlayerBoard["game"], "code" | "status" | "currentPeriod" | "periodCount" | "prices" | "priceHistory" | "suspended">;
    stocks: Stock[];
    insights: Insight[];
    players: Player[];
    feed: Pick<PlayerBoard["feed"][number], "_id" | "_creationTime" | "period" | "title" | "message" | "colour" | "imageRoot" | "stockKey" | "quantity">[];
}
