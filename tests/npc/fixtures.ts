import { legalActions } from "../../packages/game-contracts/src";
import type { NpcObservation, PublicSeat } from "../../packages/game-contracts/src";
export function observation(overrides: Partial<NpcObservation> = {}): NpcObservation
{
    const prices = [
        { stockKey: 7, value: 2 },
        { stockKey: 8, value: 2.5 },
    ];
    const players: PublicSeat[] = Array.from({ length: 4 }, (_, index) => ({
        id: `p${index}`,
        cash: 60_000,
        holdings: prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
        ranking: index + 1,
        periodStartRanking: index + 1,
    }));
    const catalog = Array.from({ length: 80 }, (_, index) => ({
        id: `c${index}`,
        stockKey: index % 2 ? 8 : 7,
        value: index < 10 ? 0.2 : (index % 4 < 2 ? 0.2 : -0.2),
    }));
    const base: NpcObservation = {
        selfId: "p0",
        prices,
        players,
        period: 0,
        finalPeriod: 5,
        turn: 0,
        actionsRemaining: 3,
        catalog,
        ownInsights: catalog.slice(0, 10),
        events: [],
        settledPeriods: [],
        legalActions: [],
        remainingSeatOrder: ["p1", "p2", "p3"],
        favouriteStockKey: 7,
        ...overrides,
    };

    return { ...base, legalActions: legalActions(base) };
}
