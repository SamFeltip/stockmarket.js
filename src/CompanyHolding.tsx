import "./company-roles.css";
import type { CompanyRole } from "../shared/company-roles";

export function CompanyHolding({ quantity, role, company }: { quantity: string; role?: CompanyRole; company: string })
{
    return role ? (
        <span className="holding-role">
            <img src={`/static/imgs/icons/${role}.svg`} alt={`${role === "chairman" ? "Chairman" : "Director"} of ${company}`} />
            {quantity}
        </span>
    ) : <>{quantity}</>;
}
