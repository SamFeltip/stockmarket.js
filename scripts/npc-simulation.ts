import type { Result } from "./npc-statistics";
import { performance } from "node:perf_hooks";
import type { Action, NpcMemory, NpcObservation, NpcProfile } from "../packages/game-contracts/src";
import { decide, emptyMemory, roster } from "../packages/npc-engine/src";
import { random, shuffled } from "../packages/npc-engine/src/random";
import { GameEnvironment, npcAction } from "../../stockmarket-ai/src";

function proxy(input: NpcObservation, style: number, next: () => number): Action
{
    if (style < 2)
    {
        const action = decide(input, {
            personality: style === 0 ? "morgan" : "casey", difficulty: "easy",
        }, emptyMemory(), String(next())).action;

        return action.kind === "buy" || action.kind === "sell" || action.kind === "pass" ? action : { kind: "pass" };
    }

    return input.legalActions[Math.floor(next() * input.legalActions.length)];
}

// Evaluation orchestration only: every deal, action, special phase and settlement uses the shared engine.
export async function simulate(seed: number, profile: NpcProfile, heldOut: boolean): Promise<Result>
{
    const seats = 4 + (seed % 3);
    const environment = await GameEnvironment.create({ seed, players: seats, periods: 6 + (seed % 5) });
    const next = random(`proxy:${seed}`);
    const assignment = shuffled(roster.filter((item) => item.id !== profile.personality), random(`roster:${seed}`));
    const profiles: (NpcProfile | undefined)[] = [profile, undefined,
        ...assignment.slice(0, seats - 2).map((item) => ({ personality: item.id, difficulty: "medium" as const }))];
    const order = shuffled(Array.from({ length: seats }, (_, index) => index), random(`order:${seed}`));
    const initial = (await environment.current()).decision!;
    const ids = initial.observation.players.map((player) => player.id);
    const focusId = ids[order.indexOf(0)];
    const memories = new Map<string, NpcMemory>();
    const result: Result = {
        personality: profile.personality, difficulty: profile.difficulty, heldOut, won: false, wealth: 0,
        cashFraction: 0, concentration: 0, passes: 0, actions: 0, reversals: 0, bluffs: 0, following: 0,
        bluffResponses: 0, latency: [], fallbacks: 0, seed,
    };
    let state = await environment.current();
    let pendingBluff: { period: number; turn: number; stockKey: number } | undefined;

    while (state.decision)
    {
        const decision = state.decision;
        const input = decision.observation;
        const index = ids.indexOf(decision.playerId);
        const actorProfile = profiles[order[index]];
        const memory = memories.get(decision.playerId) ?? emptyMemory();
        const started = performance.now();
        const selected = npcAction(decision, actorProfile ?? { personality: "morgan", difficulty: "easy" },
            memory, `decision:${seed}:${decision.token}`);
        const elapsed = performance.now() - started;
        const action = !actorProfile && decision.phase === "trading" ? proxy(input, seed % 3, next) : selected.action;
        const events = input.events;
        if (decision.phase === "trading")
        {
            const reason = actorProfile ? selected.reason : undefined;
            if (decision.playerId === focusId)
            {
                if (pendingBluff)
                {
                    const bait = pendingBluff;

                    result.bluffResponses += events.filter((event) => event.period === bait.period
                      && event.turn > bait.turn && event.actorPlayerId !== focusId
                      && event.action.kind === "buy" && event.action.stockKey === bait.stockKey).length;
                    pendingBluff = undefined;
                }

                if (reason === "bluff" && action.kind === "buy")
                {
                    pendingBluff = { period: input.period, turn: input.turn, stockKey: action.stockKey };
                }

                result.latency.push(elapsed);
                result.actions++;
                result.passes += Number(action.kind === "pass");
                result.bluffs += Number(reason === "bluff");
                const previous = events.findLast((event) =>
                    event.actorPlayerId === focusId && event.period === input.period);
                if ((action.kind === "buy" || action.kind === "sell") && previous
                  && previous.action.kind !== "pass" && previous.action.stockKey === action.stockKey
                  && previous.action.kind !== action.kind)
                {
                    result.reversals++;
                }
            }

            const previous = events.at(-1);
            if (action.kind === "buy" && previous?.action.kind === "buy"
              && previous.action.stockKey === action.stockKey && previous.actorPlayerId === focusId)
            {
                result.following++;
            }
        }

        state = await environment.step(action, decision.token);
        memories.set(decision.playerId, selected.nextMemory);
    }

    const standings = await environment.standings();
    const self = standings.find((player) => player.id === focusId)!;
    const snapshot = environment.snapshot();
    const game = snapshot.store.rows.find((row) => row._id === snapshot.gameId)!;
    if (!("prices" in game))
    {
        throw new Error("Missing final prices");
    }

    result.wealth = state.rewards[focusId];
    result.won = self.ranking === 1;
    result.cashFraction = self.cash / Math.max(1, result.wealth);
    result.concentration = Math.max(...self.holdings.map((holding) => holding.quantity
      * (game.prices.find((price) => price.stockKey === holding.stockKey)?.value ?? 0))) / Math.max(1, result.wealth);

    return result;
}
