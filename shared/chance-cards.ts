/** Non-tradable keys kept separate from recovered/imported positive stock IDs. */
export const cashStockKey = -1;

export const chanceStockKey = -2;

export const governmentLoanAmount = 10_000;

export const chanceCards = [
    { kind: "rights", name: "Rights Issue", icon: "+", effect: "50% extra shares", description: "Choose a company. All holders receive 50% extra shares, rounded down.", timing: "Played as a bargain under the general chance-card rule; the individual card entry does not specify a turn cost" },
    { kind: "hold", name: "Share Suspended", icon: "＝", effect: "Freeze a company’s price", description: "Choose one company to suspend. Its share price stays at the previous period’s level when this period settles. This card cannot be retained.", timing: "Play at the end of the round" },
    { kind: "loan", name: "Government Loan", icon: `£${governmentLoanAmount / 1000}k`, effect: "Collect £10,000", description: "Your Government Loan has matured. Collect £10,000 from the stockbroker.", timing: "Uses one bargain (turn)" },
    { kind: "debenture", name: "Debenture", icon: "◇", effect: "Bankruptcy protection", description: "Retain this card as insurance. If a company goes bankrupt, claim the full purchase price of shares you still hold in that company.", timing: "Claim within two rounds of the bankruptcy" },
    { kind: "option", name: "Option", icon: "⇄", effect: "Reserve a buy or sell price", description: "Choose a company and reserve its current share price for a future purchase or sale. Exercise the option and surrender the card within three periods.", timing: "Reserving the price and exercising the option each use one turn" },
] as const;

export type ChanceKind = typeof chanceCards[number]["kind"];

export const cashStock = {
    key: cashStockKey, name: "Cash", display: false, variation: 0, startingValue: 0,
    imagePath: "/static/imgs/icons/cash.svg", secondaryImagePath: "/static/imgs/icons/cash.svg",
};

export interface DeckCard {
    id: string;
    stockKey: number;
    value: number;
    description: string;
    chanceKind?: ChanceKind;
}

/** EP0297870A1 schedule: 8 gold cards (4 each ±10%) and 10 chance cards. */
export function specialDeck(): DeckCard[]
{
    return [
        ...[10, -10].flatMap((percent) => Array.from({ length: 4 }, (_, copy) => ({
            id: `boardgame:cash:${percent}:${copy}`, stockKey: cashStockKey,
            value: percent / 100, description: `Cash ${percent > 0 ? "+" : ""}${percent}%`,
        }))),
        ...chanceCards.flatMap((card) => Array.from({ length: 2 }, (_, copy) => ({
            id: `boardgame:chance:${card.kind}:${copy}`, stockKey: chanceStockKey,
            value: 0, description: card.name, chanceKind: card.kind,
        }))),
    ];
}

export function privateCashPercent(insights: { playerId: string; stockKey: number; value: number }[], playerId: string)
{
    return Math.round(insights.filter((card) => card.playerId === playerId && card.stockKey === cashStockKey)
        .reduce((sum, card) => sum + card.value, 0) * 100);
}
