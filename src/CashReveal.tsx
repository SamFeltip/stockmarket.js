import { cashStock } from "../shared/chance-cards";
import type { Insight } from "./display-types";

const percent = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value * 100))}%`;
const tone = (value: number) => value > 0 ? "success" : (value < 0 ? "danger" : "secondary");

export function CashReveal({ insights, index, fast = false }: { insights: Insight[]; index: number; fast?: boolean })
{
    const active = insights[index];
    const sum = Math.round(insights.slice(0, index + 1).reduce((total, card) => total + card.value, 0) * 100) / 100;
    const complete = index >= insights.length;

    return (
        <div className="cash-reveal" aria-label="Cash reveal">
            <div className="cash-reveal-total rounded">
                <div className="cash-reveal-identity">
                    <img src={cashStock.imagePath} alt="" />
                    <h2>Cash</h2>
                </div>
                <div className="text-center" aria-live="polite">
                    <p>Sum</p>
                    <h1 className="fw-bolder">{percent(sum)}</h1>
                    {active && <p className={`cash-reveal-delta text-${tone(active.value)}`}>{percent(active.value)}</p>}
                </div>
            </div>
            <div
                key={active?._id ?? "complete"}
                data-fast-reveal={active && fast ? "" : undefined}
                className={`${active ? "game-insight-card " : ""}cash-reveal-card rounded bg-white text-black`}
            >
                <img src="/static/imgs/icons/cash-outline.svg" alt="" />
                <div className={`cash-reveal-percent text-${tone(active?.value ?? sum)}`}>
                    <svg width="32" height="24" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={(active?.value ?? sum) < 0 ? "M2 3l7 7 4-4 9 9M15 15h7V8" : ((active?.value ?? sum) > 0 ? "M2 15l7-7 4 4 9-9M15 3h7v7" : "M2 9h20m-6-6 6 6-6 6")} />
                    </svg>
                    <span>{percent(active?.value ?? sum)}</span>
                </div>
                <p>{complete ? (insights.length > 0 ? "All cash insights revealed" : "No cash insights this round") : active?.description}</p>
            </div>
        </div>
    );
}
