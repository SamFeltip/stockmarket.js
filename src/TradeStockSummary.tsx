import type { ReactNode } from "react";

/** The stock/price heading shared by ordinary trades and Rights Issue purchases. */
export function TradeStockSummary({ stock, price, priceLabel, detail }: {
    stock: { name: string; imagePath: string }; price: number; priceLabel?: string; detail?: ReactNode;
})
{
    return (
        <div className="d-flex flex-fill justify-content-between align-items-center flex-row trade-stock-summary">
            <div className="d-flex flex-row align-items-center gap-2">
                <div><img className="img-primary w-100" style={{ maxWidth: 30 }} src={stock.imagePath} alt={stock.name} /></div>
                <p className="d-block">{stock.name}</p>
            </div>
            <div className="text-end">
                {priceLabel && <small className="text-secondary">{priceLabel}</small>}
                <p>{`£${price.toFixed(2)}`}</p>
                {detail}
            </div>
        </div>
    );
}
