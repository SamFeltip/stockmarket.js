import { validUsername } from "../shared/names";
import { ConvexError } from "convex/values";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [Password<DataModel>({
        profile(parameters)
        {
            const name = (typeof parameters.name === "string" ? parameters.name : String(parameters.email ?? "")).trim();
            if (!validUsername(name))
            {
                throw new ConvexError("Username must contain 1–32 characters; spaces and special characters are allowed");
            }

            const profile = Number(parameters.profile ?? 1);
            if (!Number.isInteger(profile) || profile < 1 || profile > 5)
            {
                throw new ConvexError("Choose a profile image");
            }

            return { name, email: name.toLowerCase(), profileRoot: `/static/imgs/${profile}profile.png` };
        },
    })],
});
