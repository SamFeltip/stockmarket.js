import type { Player } from "../types";
export function NpcIdentity({
    player,
    showTagline = false,
}: {
    player: Player;
    showTagline?: boolean;
})
{
    const difficulty = player.npcDifficulty ?? "medium";

    return player.kind === "npc" ? (
        <div className="npc-identity">
            <p className="badge bg-dark text-white">{`NPC · ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`}</p>
            {showTagline && <p className="small">{player.tagline}</p>}
        </div>
    ) : null;
}
