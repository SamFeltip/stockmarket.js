import "./company-roles.css";
import type { CompanyRole } from "../shared/company-roles";

export function TradeRoleLabel({ role }: { role?: CompanyRole })
{
    return role ? <p className="trade-role-label">{role}</p> : null;
}

export function TradeRoleChange({ item }: { item: { roleBefore?: CompanyRole; roleAfter?: CompanyRole } })
{
    const { roleBefore, roleAfter } = item;
    const promoted = roleBefore === "director" && roleAfter === "chairman";
    const demoted = roleBefore === "chairman" && roleAfter === "director";
    if (promoted || demoted)
    {
        return <div className="trade-role-change"><p>{promoted ? "promoted to chairman" : "demoted to director"}</p></div>;
    }

    const steppedDown = roleBefore && roleBefore !== roleAfter
      && (roleBefore === "chairman" || !roleAfter);
    const gained = roleAfter && roleAfter !== roleBefore;
    if (!steppedDown && !gained)
    {
        return null;
    }

    return (
        <div className="trade-role-change">
            {steppedDown && <p>{`stepped down as ${roleBefore}`}</p>}
            {gained && <p>{`new ${roleAfter}`}</p>}
        </div>
    );
}
