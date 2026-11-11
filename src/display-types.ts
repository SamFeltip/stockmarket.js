import type { CompanyRole } from "../shared/company-roles";
import type { Board as PlayerBoard } from "./types";

export type Stock = Pick<PlayerBoard["stocks"][number], "key" | "name" | "display" | "imagePath" | "secondaryImagePath"> & { variation?: number; startingValue?: number };

export type Insight = Pick<PlayerBoard["insights"][number], "_id" | "playerId" | "stockKey" | "value" | "description" | "resolved" | "chanceKind" | "used" | "period" | "bonusRole" | "removedInsightId">;

export type Player = Pick<PlayerBoard["players"][number],
    "_id" | "name" | "profileRoot" | "cash" | "holdings" | "netWorth" | "ranking"> & {
        kind?: PlayerBoard["players"][number]["kind"];
        roles?: { stockKey: number; role: CompanyRole }[];
    };

export interface Board {
    game: Pick<PlayerBoard["game"], "code" | "status" | "currentPeriod" | "periodCount" | "prices" | "priceHistory" | "suspended" | "suspensionPeriod" | "rightsIssue" | "pack" | "tradingDates"> & { turn?: number; currentPlayerId?: string };
    trades?: PlayerBoard["trades"];
    stocks: Stock[];
    insights: Insight[];
    players: Player[];
    feed: Pick<PlayerBoard["feed"][number], "_id" | "_creationTime" | "period" | "title" | "message" | "colour" | "imageRoot" | "stockKey" | "quantity" | "cashBonus" | "debenturePayout" | "roleBefore" | "roleAfter">[];
}
