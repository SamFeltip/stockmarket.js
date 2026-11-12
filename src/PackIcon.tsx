import type { Pack } from "../shared/packs";
import { packPresentation } from "./pack-presentation";
import { asset } from "./spectator/assets";

export function PackIcon({ pack = "classic" }: { pack?: Pack })
{
    const presentation = packPresentation[pack];
    if (!("icon" in presentation))
    {
        return <img className="pack-icon pack-icon-classic" width="23" height="23" src={asset("/static/imgs/icons/Stock.svg")} alt="" />;
    }

    return (
        <svg
            className="pack-icon"
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
            <path d={presentation.icon} />
        </svg>
    );
}
