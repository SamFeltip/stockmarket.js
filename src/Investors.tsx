import { money } from "./shared";
import type { Player } from "./types";

const fallbackPhoto = "/static/imgs/1profile.png";

export function Investors({ players, stockKey }: { players: Player[]; stockKey: number })
{
    const investors = players.filter((player) => player.holdings.some((holding) =>
        holding.stockKey === stockKey && holding.quantity > 0));

    return (
        <section id="investors" aria-labelledby="investors-title">
            <h4 id="investors-title">Investors</h4>
            {investors.length > 0 ? (
                <ul className="stock-investors list-unstyled mb-0">
                    {investors.map((investor) => (
                        <li key={investor._id}>
                            <img
                                src={investor.profileRoot || fallbackPhoto}
                                alt={investor.name}
                                title={investor.name}
                                width={48}
                                height={48}
                                onError={(event) =>
                                {
                                    if (!event.currentTarget.src.endsWith(fallbackPhoto))
                                    {
                                        event.currentTarget.src = fallbackPhoto;
                                    }
                                }}
                            />
                            <span className="visually-hidden">
                                {investor.name}
                                {": "}
                            </span>
                            <span>
                                {money(investor.holdings.find((holding) =>
                                    holding.stockKey === stockKey)?.quantity ?? 0)}
                            </span>
                            <span className="visually-hidden"> shares</span>
                        </li>
                    ))}
                </ul>
            ) : <p className="stock-empty">No investors yet.</p>}
        </section>
    );
}
