import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("Recover overdue NPC turns", { minutes: 1 }, internal.npc.recovery.sweep, {});
export default crons;
