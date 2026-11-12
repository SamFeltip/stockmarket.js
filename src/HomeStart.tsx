import { Link } from "react-router-dom";
import { asset } from "./spectator/assets";

const className = "home-start btn btn-primary d-flex flex-column justify-content-center align-items-center text-center";

export function HomeStart({ busy, disabled, onCreate }: { busy?: boolean; disabled?: boolean; onCreate?: () => void })
{
    const icon = <img width={48} height={39} src={asset("/static/imgs/icons/Handshake.svg")} alt="" />;

    return onCreate ? (
        <button type="button" className={className} disabled={disabled || busy} onClick={onCreate}>
            {icon}
            <span>{busy ? "Creating game…" : "Create game"}</span>
        </button>
    ) : (
        <Link to="/games/new" className={className}>
            {icon}
            <span>Start game</span>
        </Link>
    );
}
