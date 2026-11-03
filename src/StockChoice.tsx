import { SelectionTick } from "./SelectionTick";
import { money } from "./shared";

export function StockChoice({ stock, quantity, unitPrice, unavailableReason, selected, disabled = false,
    name, onSelect, showName = false }: {
    stock: { name: string; imagePath: string }; quantity?: number; unitPrice?: number | null; showName?: boolean;
    unavailableReason?: string | null; selected: boolean; disabled?: boolean; name: string; onSelect: () => void;
})
{
    return (
        <label className={`debenture-stock ${selected ? "is-selected" : ""}`}>
            <input
                className="visually-hidden"
                type="radio"
                name={name}
                aria-label={quantity === undefined ? stock.name : `${stock.name}: ${money(quantity)} stocks`}
                checked={selected}
                disabled={disabled || Boolean(unavailableReason)}
                onChange={onSelect}
            />
            <span className="debenture-stock-picture">
                <img src={stock.imagePath} alt={stock.name} />
            </span>
            {showName && <strong>{stock.name}</strong>}
            {selected && (
                <span className="debenture-stock-check" aria-hidden="true">
                    <SelectionTick />
                </span>
            )}
            {quantity !== undefined && <span>{`${money(quantity)} stocks`}</span>}
            {unitPrice !== null && unitPrice !== undefined && (
                <span className="debenture-stock-price">
                    {`${Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) > 0.000_001 ? "≈" : ""}£${unitPrice.toFixed(2)} each`}
                </span>
            )}
            {unavailableReason && <span className="debenture-unavailable">{unavailableReason}</span>}
        </label>
    );
}
