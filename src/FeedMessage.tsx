import { asset } from "./spectator/assets";
import { cashStock } from "../shared/chance-cards";
import { TradeRoleChange } from "./TradeRole";
import type { Board } from "./display-types";
import { money } from "./shared";

export function FeedMessage({ item, stocks, detailed = false }: {
    item: Board["feed"][number]; stocks: Board["stocks"]; detailed?: boolean;
})
{
    if (item.cashBonus !== undefined)
    {
        const printMoney = item.message === "played Print Money";
        const amount = `£${money(item.cashBonus)}`;

        return (
            <div>
                <p className="trade-message text-success" aria-label={printMoney ? `Print Money added ${amount}` : `Received ${amount} government bonus`}>
                    <img src={asset(cashStock.imagePath)} alt="" />
                    {amount}
                </p>
                {(detailed || printMoney) && <p className="trade-description">{item.message}</p>}
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

    const payout = item.debenturePayout;
    const debenture = payout !== undefined;
    const redemptionName = item.redemptionName ?? "Debenture";
    const tradeLabel = debenture
        ? `Redeemed ${money(Math.abs(quantity))} ${stock.name} shares with a ${redemptionName}`
        : `${quantity > 0 ? "Bought" : "Sold"} ${money(Math.abs(quantity))} ${stock.name} shares`;

    return (
        <div>
            <p
                className={`trade-message text-${quantity > 0 ? "success" : "danger"}`}
                aria-label={tradeLabel}
            >
                <img src={stock.imagePath} alt="" />
                {money(quantity)}
            </p>
            {item.message.includes("shares in the Rights Issue") && (
                <p className="trade-description">Rights Issue · £1 per share</p>
            )}
            {debenture && <p className="trade-description">{`${redemptionName} sold at £${money(payout)}`}</p>}
            {detailed && !debenture && (
                <p className="trade-description">
                    {`${quantity > 0 ? "Purchased" : "Sold"} ${money(Math.abs(quantity))} ${stock.name} stocks`}
                </p>
            )}
            {detailed && <TradeRoleChange item={item} />}
        </div>
    );
}
