import { cashStock } from "../shared/chance-cards";
import { TradeRoleChange } from "./TradeRole";
import type { Board } from "./display-types";
import { money } from "./shared";

export function FeedMessage({ item, stocks, detailed = false }: {
    item: Board["feed"][number]; stocks: Board["stocks"]; detailed?: boolean;
})
{
    if (item.cashBonus)
    {
        return (
            <div>
                <p className="trade-message text-success" aria-label={`Received £${money(item.cashBonus)} government bonus`}>
                    <img src={cashStock.imagePath} alt="" />
                    {`£${money(item.cashBonus)}`}
                </p>
                {detailed && <p className="trade-description">received government bonus</p>}
            </div>
        );
    }

    // Older games have text-only events; keep their history readable after upgrading.
    const legacy = /^(bought|sold) (\d+) shares in (.+)$/.exec(item.message);
    const stock = stocks.find((candidate) => candidate.key === item.stockKey
      || (item.stockKey === undefined && candidate.name === legacy?.[3]));
    const quantity = item.quantity ?? (legacy ? Number(legacy[2]) * (legacy[1] === "sold" ? -1 : 1) : 0);
    if (!stock || !quantity)
    {
        return <p>{item.message}</p>;
    }

    return (
        <div>
            <p
                className={`trade-message text-${quantity > 0 ? "success" : "danger"}`}
                aria-label={`${quantity > 0 ? "Bought" : "Sold"} ${money(Math.abs(quantity))} ${stock.name} shares`}
            >
                <img src={stock.imagePath} alt="" />
                {money(quantity)}
            </p>
            {item.message.includes("shares in the Rights Issue") && (
                <p className="trade-description">Rights Issue · £1 per share</p>
            )}
            {detailed && (
                <p className="trade-description">
                    {item.debenturePayout === undefined ? `${quantity > 0 ? "Purchased" : "Sold"} ${money(Math.abs(quantity))} ${stock.name} stocks`
                        : `Debenture sold at £${money(item.debenturePayout)}`}
                </p>
            )}
            {detailed && <TradeRoleChange item={item} />}
        </div>
    );
}
