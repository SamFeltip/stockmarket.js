import { asset } from "./spectator/assets";
import "./company-roles.css";
import type { CompanyRole } from "../shared/company-roles";

export function CompanyHolding({ quantity, role, company }: { quantity: string; role?: CompanyRole; company: string })
{
    return role ? (
        <span className="holding-role">
            <img src={asset(`/static/imgs/icons/${role}.svg`)} alt={`${role === "chairman" ? "Chairman" : "Director"} of ${company}`} />
            {quantity}
        </span>
    ) : <>{quantity}</>;
}
