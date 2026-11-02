import { money } from "./shared";
import type { Player } from "./types";

import { RolePortrait } from "./RolePortrait";

export function Investors({ players, stockKey }: { players: Player[]; stockKey: number })
{
    const investors = players.filter((player) => player.holdings.some((holding) =>
        holding.stockKey === stockKey && holding.quantity > 0));

    return (
        <section id="investors" aria-labelledby="investors-title">
            <h4 id="investors-title">Investors</h4>
            {investors.length > 0 ? (
                <ul className="stock-investors list-unstyled mb-0">
                    {investors.map((investor) =>
                    {
                        const role = investor.roles.find((item) => item.stockKey === stockKey)?.role;

                        return (
                            <li key={investor._id}>
                                <RolePortrait name={investor.name} profileRoot={investor.profileRoot} role={role} />
                                <span className="visually-hidden">
                                    {investor.name}
                                    {": "}
                                </span>
                                <span>
                                    {money(investor.holdings.find((holding) =>
                                        holding.stockKey === stockKey)?.quantity ?? 0)}
                                </span>
                                <span className="visually-hidden"> shares</span>
                                {role && <span className="investor-role-name">{role === "chairman" ? "Chairman" : "Director"}</span>}
                            </li>
                        );
                    })}
                </ul>
            ) : <p className="stock-empty">No investors yet.</p>}
        </section>
    );
}
