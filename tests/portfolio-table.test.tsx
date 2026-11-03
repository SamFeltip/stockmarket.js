import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PortfolioTable } from "../src/PortfolioTable";

const stocks = [{ key: 1, name: "First", imagePath: "/first.svg" },
    { key: 2, name: "Second", imagePath: "/second.svg" }];
const players = [
    { id: "bob", name: "Bob", profileRoot: "/bob.png", cash: 10_000, netWorth: 25_000,
        holdings: [{ stockKey: 2, quantity: 2000 }] },
    { id: "sam", name: "Sam", profileRoot: "/sam.png", cash: 12_000, netWorth: 30_000,
        holdings: [{ stockKey: 1, quantity: 1000 }] },
];

it("adapts the existing portfolio table to ordered decisions with compact cash and ineligible holders muted", () =>
{
    const html = renderToStaticMarkup(
        <PortfolioTable stocks={stocks} players={players} activePlayerId="bob" compact mutedStockKey={2} />,
    );

    expect(html).toContain("£10k");
    expect(html).toContain("£25k");
    expect(html.indexOf("Bob")).toBeLessThan(html.indexOf("Sam"));
    expect(html).toMatch(/class="current is-active "/);
    expect(html).toMatch(/class=" is-muted"/);
    expect(html).toContain("alt=\"First\"");
    expect(html).toContain("alt=\"Second\"");
    expect(html).toContain(">2k<");
});

it("preserves full cash values and company roles in the ordinary spectator portfolio", () =>
{
    const html = renderToStaticMarkup(
        <PortfolioTable
            stocks={stocks}
            players={[
                { ...players[0], roles: [{ stockKey: 2, role: "chairman" }] },
            ]}
        />,
    );

    expect(html).toContain("£10,000");
    expect(html).toContain("alt=\"Chairman of Second\"");
    expect(html).not.toContain("is-muted\"");
});
