import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StockInsightChange } from "../src/StockInsightChange";
import type { Insight } from "../src/types";

function render(cards: Pick<Insight, "value" | "description" | "forecast">[], round: number)
{
    const insights = cards.map((card) => ({ ...card, stockKey: 1 }));

    return renderToStaticMarkup(
        <StockInsightChange insights={insights} stockKey={1} game={{ pack: "tech", currentPeriod: round, periodCount: 143 }} />,
    );
}

it("shows a single relevant window for overlapping forecasts and clears the badge after expiry", () =>
{
    const forecasts = [
        { forecast: { from: 4, to: 7 }, value: 2, description: "8 Feb – 19 Feb" },
        { forecast: { from: 2, to: 5 }, value: 3, description: "1 Feb – 12 Feb" },
    ];
    for (const round of [0, 3, 4])
    {
        const html = render(forecasts, round);

        expect(html).toContain("title=\"1 Feb – 12 Feb\"");
        expect(html).toContain("£3.00");
        expect(html).not.toContain("£5.00");
    }

    expect(render(forecasts, 5)).toContain("title=\"8 Feb – 19 Feb\"");
    expect(render(forecasts, 7)).toBe("");
});

it("keeps adding ordinary insights and preserves a real zero forecast", () =>
{
    expect(render([{ value: 1.5, description: "First" }, { value: -0.5, description: "Second" }], 0))
        .toContain("£1.00");
    expect(render([{ forecast: { from: 0, to: 3 }, value: 0, description: "1 Feb – 12 Feb" }], 0))
        .toContain("£0.00");
});
