import "./company-roles.css";
import { companyRoleThresholds } from "../shared/company-roles";
import { money } from "./shared";

export function TradePosition({ cash, holding, buying }: { cash: number; holding: number; buying: boolean })
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
            {buying && (
                <div className="trade-role-progress">
                    {(["chairman", "director"] as const).map((role) =>
                    {
                        const remaining = Math.max(0, companyRoleThresholds[role] - holding);

                        return (
                            <div key={role}>
                                <img src={`/static/imgs/icons/${role}.svg`} alt="" />
                                <span>
                                    {remaining > 0 ? `${money(remaining)} stocks until ${role}`
                                        : `${role === "chairman" ? "Chairman" : "Director"} threshold reached`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
