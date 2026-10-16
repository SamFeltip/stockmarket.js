import { query } from "./_generated/server";
import { currentUser } from "./library";

export const me = query({ args: {}, handler: async (context) =>
{
    const user = await currentUser(context);

    return { _id: user._id, name: user.name, profileRoot: user.profileRoot };
} });

export const list = query({ args: {}, handler: async (context) =>
{
    await currentUser(context);
    const users = await context.db.query("users").take(500);

    return users.map((user) => ({ _id: user._id, name: user.name }));
} });
