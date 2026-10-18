import type { Action, NpcObservation } from "../../game-contracts/src";
export function smallTrade(
    observation: NpcObservation,
    kind: "buy" | "sell",
    stockKey: number,
    limit = 2000,
): Action
{
    return (
        observation.legalActions
            .filter(
                (action) =>
                    action.kind === kind
                    && action.stockKey === stockKey
                    && action.quantity <= limit,
            )
            .toSorted(
                (a, b) =>
                    (b.kind === "pass" ? 0 : b.quantity) - (a.kind === "pass" ? 0 : a.quantity),
            )[0] ?? { kind: "pass" }
    );
}

export function isLegalProposal(action: unknown, legal: readonly Action[]): action is Action
{
    if (!action || typeof action !== "object" || !("kind" in action))
    {
        return false;
    }

    return legal.some(
        (item) =>
            item.kind === action.kind
            && (item.kind === "pass"
              || ("stockKey" in action
                && "quantity" in action
                && item.stockKey === action.stockKey
                && item.quantity === action.quantity)),
    );
}
