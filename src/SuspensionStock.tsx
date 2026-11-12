import { sharesHeld } from "../shared/suspensions";
import { SelectionTick } from "./SelectionTick";
import type { Player, Stock } from "./display-types";

export function SuspensionStock({ stock, quantity, holders, before, after, selected = false, disabled = false,
    unavailable = false, spectator = false, onSelect, targeting }: {
    stock: Stock; quantity: number; holders?: Player[]; spectator?: boolean;
    before: number; after: number; selected?: boolean; disabled?: boolean; unavailable?: boolean; onSelect?: () => void;
    targeting?: { checked: Player["_id"][]; suspended: (playerId: Player["_id"]) => boolean;
        toggle?: (playerId: Player["_id"], checked: boolean) => void };
})
{
    const change = Math.round((after - before) * 100) / 100;
    const tone = change < 0 ? "danger" : (change > 0 ? "success" : "secondary");
    const content = (
        <>
            <img src={stock.imagePath} alt="" />
            <strong>{stock.name}</strong>
            {!spectator && <span className="suspension-quantity">{`${quantity.toLocaleString("en-GB")} shares`}</span>}
            {spectator && (
                <div className="suspension-spectator-price">
                    <span>worth</span>
                    <strong>{`£${before.toFixed(2)}`}</strong>
                </div>
            )}
            <div
                className={`suspension-change total-insight text-${tone}`}
                aria-label={`Price change: ${change >= 0 ? "+" : "−"}£${Math.abs(change).toFixed(2)}`}
            >
                {change !== 0 && <img src={`/static/imgs/icons/stock_${change > 0 ? "up" : "down"}.svg`} alt="" />}
                <span>{`${change === 0 ? "+" : ""}£${Math.abs(change).toFixed(2)}`}</span>
            </div>
            {spectator ? (
                <div className="suspension-spectator-price">
                    <span>new valuation</span>
                    <strong>{`£${after.toFixed(2)}`}</strong>
                </div>
            ) : (
                <div className="suspension-valuations">
                    <div>
                        <span>worth</span>
                        <strong>{`£${before.toFixed(2)}`}</strong>
                    </div>
                    <div>
                        <span>new valuation</span>
                        <strong>{`£${after.toFixed(2)}`}</strong>
                    </div>
                </div>
            )}

        </>
    );

    const choice = onSelect && (
        <input
            className="visually-hidden"
            type="radio"
            name="suspended-stock"
            aria-label={stock.name}
            checked={selected}
            disabled={disabled}
            onChange={onSelect}
        />
    );
    const check = <span className="suspension-check" aria-hidden="true">{selected && <SelectionTick />}</span>;
    const holderFooter = holders && (
        <span className="suspension-holders">
            <small>{holders.length > 0 ? "Shareholders" : "No shareholders"}</small>
            {holders.length > 0 && (
                <span className="suspension-holder-avatars">
                    {holders.map((holder) =>
                    {
                        const label = `${holder.name} · ${sharesHeld(holder, stock.key).toLocaleString("en-GB")} shares`;
                        if (!targeting)
                        {
                            return <img key={holder._id} src={holder.profileRoot} alt={holder.name} title={label} />;
                        }

                        const suspended = targeting.suspended(holder._id);
                        const checked = suspended || targeting.checked.includes(holder._id);

                        const badge = (checked || targeting.toggle)
                            ? <span className="suspension-target-tick" aria-hidden="true">{checked && <SelectionTick />}</span>
                            : null;
                        if (!targeting.toggle)
                        {
                            return (
                                <span className="suspension-avatar-choice" key={holder._id} title={label}>
                                    <img src={holder.profileRoot} alt={holder.name} />
                                    {badge}
                                </span>
                            );
                        }

                        return (
                            <label className="suspension-avatar-choice" key={holder._id} title={label}>
                                <input
                                    className="visually-hidden"
                                    type="checkbox"
                                    aria-label={`${stock.name}: ${label}`}
                                    checked={checked}
                                    disabled={disabled || suspended}
                                    onChange={(event) => targeting.toggle?.(holder._id, event.currentTarget.checked)}
                                />
                                <img src={holder.profileRoot} alt="" />
                                {badge}
                            </label>
                        );
                    })}
                </span>
            )}
        </span>
    );
    const className = `suspension-stock ${selected ? "is-selected" : ""} ${disabled ? "is-unavailable" : ""}`;
    if (targeting && onSelect)
    {
        return (
            <article className={className}>
                <label className="suspension-stock-choice">
                    {choice}
                    {check}
                    {content}
                </label>
                {holderFooter}
                {unavailable && <small>Already suspended</small>}
            </article>
        );
    }

    return onSelect ? (
        <label className={className}>
            {choice}
            {check}
            {content}
            {holderFooter}
            {unavailable && <small>Already suspended</small>}
        </label>
    ) : (
        <article className={className}>
            {content}
            {holderFooter}
        </article>
    );
}
