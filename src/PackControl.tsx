import { packIds, packs, type Pack } from "../shared/packs";
import "./pack-control.css";

export function PackControl({ pack = "classic", busy, onChange }: {
    pack?: Pack; busy?: boolean; onChange?: (pack: Pack) => void;
})
{
    return (
        <section className="pack-control" aria-label="Stock pack">
            {onChange ? (
                <div className="pack-options" role="group" aria-label="Choose a stock pack">
                    {packIds.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={`pack-option pack-${id}`}
                            aria-pressed={id === pack}
                            disabled={busy}
                            onClick={() => onChange(id)}
                        >
                            <PackIcon pack={id} />
                            <span>{packs[id].name}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className={`pack-current pack-${pack}`}>
                    <PackIcon pack={pack} />
                    <strong>{packs[pack].name}</strong>
                </div>
            )}
            <p className="pack-summary" aria-live="polite">{packs[pack].summary}</p>
        </section>
    );
}

function PackIcon({ pack }: { pack: Pack })
{
    return (
        <svg
            viewBox="0 0 24 24"
            width="23"
            height="23"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d={packs[pack].icon} />
        </svg>
    );
}
