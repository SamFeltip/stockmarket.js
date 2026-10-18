import type { Result } from "./npc-statistics";
import { performance } from "node:perf_hooks";
import { legalActions, settledPrice, transition } from "../packages/game-contracts/src";
import type {
    Action,
    NpcObservation,
    NpcProfile,
    PublicActionEvent,
    PublicPeriodSummary,
    PublicSeat,
} from "../packages/game-contracts/src";
import { decide, emptyMemory, isLegalProposal, roster } from "../packages/npc-engine/src";
import { random, shuffled } from "../packages/npc-engine/src/random";
import { insightCatalog, stockCatalog } from "../convex/catalog";

const catalog = insightCatalog.map((card) => ({
    id: String(card.key),
    stockKey: card.stockKey,
    value: card.value,
}));

function proxy(input: NpcObservation, style: number, next: () => number): Action
{
    if (style === 0)
    {
        return decide(
            input,
            { personality: "morgan", difficulty: "easy" },
            emptyMemory(),
            "cautious-proxy",
        ).action;
    }

    if (style === 1)
    {
        return decide(
            input,
            { personality: "casey", difficulty: "easy" },
            emptyMemory(),
            String(next()),
        ).action;
    }

    return input.legalActions[Math.floor(next() * input.legalActions.length)];
}

export function simulate(seed: number, profile: NpcProfile, heldOut: boolean): Result
{
    const seats = 4 + (seed % 3);
    const finalPeriod = 5 + (seed % 5);
    const next = random(`proxy:${seed}`);
    const assignment = shuffled(
        roster.filter((item) => item.id !== profile.personality),
        random(`roster:${seed}`),
    );
    const profiles: (NpcProfile | undefined)[] = [
        profile,
        undefined,
        ...assignment
            .slice(0, seats - 2)
            .map((item) => ({ personality: item.id, difficulty: "medium" as const })),
    ];
    const order = shuffled(
        Array.from({ length: seats }, (_, index) => String(index)),
        random(`order:${seed}`),
    );
    let prices = stockCatalog
        .filter((stock) => stock.display)
        .map((stock) => ({ stockKey: stock.key, value: stock.startingValue }));
    let players: PublicSeat[] = order.map((id, index) => ({
        id,
        cash: 60_000,
        holdings: prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
        ranking: index + 1,
        periodStartRanking: index + 1,
    }));
    const memories = profiles.map(() => emptyMemory());
    const events: PublicActionEvent[] = [];
    const summaries: PublicPeriodSummary[] = [];
    const result: Result = {
        personality: profile.personality,
        difficulty: profile.difficulty,
        heldOut,
        won: false,
        wealth: 0,
        cashFraction: 0,
        concentration: 0,
        passes: 0,
        actions: 0,
        reversals: 0,
        bluffs: 0,
        following: 0,
        bluffResponses: 0,
        latency: [],
        fallbacks: 0,
        seed,
    };
    let pendingBluff: { period: number; turn: number; stockKey: number } | undefined;
    for (let period = 0; period <= finalPeriod; period++)
    {
        const deck = shuffled(catalog, random(`hidden-deal:${seed}:${period}`));
        const hands = new Map(
            order.map((id, index) => [id, deck.slice(index * 10, index * 10 + 10)]),
        );
        for (let turn = 0; turn < seats * 3; turn++)
        {
            const selfId = order[(turn + period) % seats];
            const input: NpcObservation = {
                selfId,
                players,
                prices,
                period,
                finalPeriod,
                turn,
                actionsRemaining: (3 - Math.floor(turn / seats)) as 1 | 2 | 3,
                ownInsights: hands.get(selfId)!,
                catalog,
                events,
                settledPeriods: summaries,
                legalActions: legalActions({ selfId, players, prices }),
                favouriteStockKey: 7,
                remainingSeatOrder: Array.from(
                    { length: seats - 1 },
                    (_, index) => order[(turn + period + index + 1) % seats],
                ),
            };
            const index = Number(selfId);
            const actorProfile = profiles[index];
            const started = performance.now();
            const decision = actorProfile
                ? decide(input, actorProfile, memories[index], `decision:${seed}:${period}:${turn}`)
                : undefined;
            const elapsed = performance.now() - started;
            let action = decision?.action ?? proxy(input, seed % 3, next);
            if (!isLegalProposal(action, input.legalActions))
            {
                action = { kind: "pass" };
                result.fallbacks++;
            }

            if (decision)
            {
                memories[index] = decision.nextMemory;
            }

            if (selfId === "0")
            {
                if (pendingBluff)
                {
                    const bait = pendingBluff;

                    result.bluffResponses += events.filter(
                        (event) =>
                            event.period === bait.period
                            && event.turn > bait.turn
                            && event.actorPlayerId !== "0"
                            && event.action.kind === "buy"
                            && event.action.stockKey === bait.stockKey,
                    ).length;
                    pendingBluff = undefined;
                }

                if (decision?.reason === "bluff" && action.kind === "buy")
                {
                    pendingBluff = { period, turn, stockKey: action.stockKey };
                }

                result.latency.push(elapsed);
                result.actions++;

                if (action.kind === "pass")
                {
                    result.passes++;
                }

                if (decision?.reason === "bluff")
                {
                    result.bluffs++;
                }

                const previous = events.findLast(
                    (event) => event.actorPlayerId === "0" && event.period === period,
                );
                if (
                    action.kind !== "pass"
                    && previous?.action.kind !== "pass"
                    && previous
                    && previous.action.stockKey === action.stockKey
                    && previous.action.kind !== action.kind
                )
                {
                    result.reversals++;
                }
            }

            if (action.kind === "buy")
            {
                const previous = events.at(-1);
                if (
                    previous?.action.kind === "buy"
                    && previous.action.stockKey === action.stockKey
                    && previous.actorPlayerId === "0"
                )
                {
                    result.following++;
                }
            }

            players = [...transition({ selfId, players, prices }, action).players];
            events.push({ actorPlayerId: selfId, period, turn, action });
        }

        const opening = prices;

        prices = prices.map((price) => ({
            ...price,
            value: settledPrice(
                price.value,
                deck
                    .slice(0, seats * 10)
                    .filter((card) => card.stockKey === price.stockKey)
                    .reduce((sum, card) => sum + card.value, 0),
            ),
        }));
        summaries.push({ period, opening, settled: prices });
        const worth = (seat: PublicSeat) =>
            seat.cash
            + seat.holdings.reduce(
                (sum, holding) =>
                    sum
                    + holding.quantity
                    * prices.find((price) => price.stockKey === holding.stockKey)!.value,
                0,
            );
        const ranks = players.toSorted((a, b) => worth(b) - worth(a));

        players = players.map((seat) => ({
            ...seat,
            ranking: ranks.findIndex((item) => item.id === seat.id) + 1,
            periodStartRanking: ranks.findIndex((item) => item.id === seat.id) + 1,
        }));
    }

    const self = players.find((seat) => seat.id === "0")!;
    const values = self.holdings.map(
        (holding) =>
            holding.quantity * prices.find((price) => price.stockKey === holding.stockKey)!.value,
    );

    result.wealth = self.cash + values.reduce((sum, value) => sum + value, 0);
    result.won = self.ranking === 1;
    result.cashFraction = self.cash / Math.max(1, result.wealth);
    result.concentration = Math.max(...values) / Math.max(1, result.wealth);

    return result;
}
