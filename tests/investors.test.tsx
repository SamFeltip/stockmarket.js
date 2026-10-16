import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { api } from "../convex/_generated/api";
import { Investors } from "../src/Investors";
import { setup } from "./game-setup";

describe("Investor portraits", () =>
{
    it("renders the faces and formatted holdings of investors in the selected company only", async () =>
    {
        const { t, sam, bob, outsider } = await setup();

        await outsider.mutation(api.games.join, { code: "test" });
        const waiting = await sam.query(api.board.get, { code: "test" });

        expect(renderToStaticMarkup(<Investors players={waiting.players} stockKey={8} />)).toContain("No investors yet.");
        await t.run(async (context) =>
        {
            await context.db.patch(waiting.players[1].userId, { profileRoot: "/static/imgs/2profile.png" });
        });
        await sam.mutation(api.games.start, { code: "test" });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, stockKey: 8, quantity: 1000 });
        await bob.mutation(api.trading.play, { code: "test", expectedTurn: 1, stockKey: 8, quantity: 5000 });
        const board = await sam.query(api.board.get, { code: "test" });
        const html = renderToStaticMarkup(<Investors players={board.players} stockKey={8} />);

        expect(html).toContain("alt=\"sam\"");
        expect(html).toContain("alt=\"bob\"");
        expect(html).toContain("/static/imgs/1profile.png");
        expect(html).toContain("/static/imgs/2profile.png");
        expect(html).toContain("1,000");
        expect(html).toContain("5,000");
        expect(html).not.toContain("alt=\"outsider\"");
        expect(renderToStaticMarkup(<Investors players={board.players} stockKey={7} />)).toContain("No investors yet.");
    });
});
