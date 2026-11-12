import { asset } from "./spectator/assets";
import "./company-roles.css";
import { companyRoleThresholds, type CompanyRole } from "../shared/company-roles";
import { money } from "./shared";

export function TradePosition({ cash, holding, buying, assignedRoles = [] }: {
    cash: number; holding: number; buying: boolean; assignedRoles?: CompanyRole[];
})
{
    return (
        <div className="transaction-body">
            <p>
                Cash £
                {money(cash)}
            </p>
            <p className="trade-shares-held">
                Shares held
                {" "}
                {money(holding)}
            </p>
            {(buying || assignedRoles.length > 0) && (
                <div className="trade-role-progress">
                    {(["chairman", "director"] as const).filter((role) => buying || assignedRoles.includes(role)).map((role) =>
                    {
                        const remaining = Math.max(0, companyRoleThresholds[role] - holding);

                        return (
                            <div key={role}>
                                <img src={asset(`/static/imgs/icons/${role}.svg`)} alt="" />
                                <span>
                                    {assignedRoles.includes(role) ? `${role === "chairman" ? "Chairman" : "Director"} role assigned`
                                        : (remaining > 0 ? `${money(remaining)} stocks until ${role}`
                                            : `${role === "chairman" ? "Chairman" : "Director"} threshold reached`)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
