import { RolePortrait } from "./RolePortrait";
import type { Board, Stock } from "./display-types";

export function StockRoleFooter({ board, stock, compact = false }: { board: Board; stock: Stock; compact?: boolean })
{
    const entries = board.players.flatMap((player) =>
    {
        const bonus = board.insights.find((insight) => insight.stockKey === stock.key
          && insight.playerId === player._id && insight.bonusRole);
        const role = player.roles?.find((item) => item.stockKey === stock.key)?.role ?? bonus?.bonusRole;

        return role ? [{ player, role, bonus }] : [];
    }).toSorted((a, b) => Number(b.role === "chairman") - Number(a.role === "chairman"));
    if (entries.length === 0)
    {
        return null;
    }

    return (
        <footer className={`stock-role-footer${compact ? " stock-role-footer-compact" : ""}`} aria-label={`${stock.name} company roles`}>
            {entries.map(({ player, role, bonus }) => (
                <div className="stock-role-entry" key={player._id}>
                    <RolePortrait name={player.name} profileRoot={player.profileRoot} role={role} />
                    <div className={compact ? "visually-hidden" : undefined}>
                        <p>{`${player.name} · ${role === "chairman" ? "Chairman" : "Director"}`}</p>
                        {bonus && <p className="text-success">{`+£${bonus.value.toFixed(2)} · ${bonus.bonusRole === "chairman" ? "chairman influence" : bonus.description}`}</p>}
                    </div>
                </div>
            ))}
        </footer>
    );
}
