import { asset } from "./spectator/assets";
import "./company-roles.css";
import type { CompanyRole } from "../shared/company-roles";

const roleIcons = {
    chairman: "/static/imgs/icons/chairman.svg",
    director: "/static/imgs/icons/director.svg",
};

export function RolePortrait({ name, profileRoot, role }: { name: string; profileRoot: string; role?: CompanyRole })
{
    const fallback = asset("/static/imgs/1profile.png");

    return (
        <div className="role-portrait">
            <img
                className="investor-photo"
                src={profileRoot || fallback}
                alt={name}
                title={name}
                width={48}
                height={48}
                onError={(event) =>
                {
                    if (event.currentTarget.getAttribute("src") !== fallback)
                    {
                        event.currentTarget.src = fallback;
                    }
                }}
            />
            {role && <img className="company-role-badge" src={asset(roleIcons[role])} alt={role === "chairman" ? "Chairman" : "Director"} />}
        </div>
    );
}
