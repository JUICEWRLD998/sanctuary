/**
 * lib/seeds.ts — read-only demo circles, bundled into the app.
 *
 * The managed `demo` and `default-demo` circles are the bounty's "always-works"
 * proof: completed lifecycles whose every event links to a real testnet tx.
 * They must render in production, but Vercel's filesystem is read-only/ephemeral
 * and `data/` is gitignored, so we can't rely on their JSON files being present
 * at runtime. Instead we import them statically here — they get compiled into
 * the bundle and served from memory by lib/store's read fallback.
 *
 * These are READ-ONLY. The orchestrator's `reset`/re-drive path writes to the
 * active store (DB/file), which shadows the seed by id; the seed itself is never
 * mutated. To refresh a seed after re-driving a demo on testnet, re-copy its
 * JSON from data/circles/ into lib/seeds-data/.
 */
import type { CircleState } from "./ledger-types";
import demo from "./seeds-data/demo.json";
import defaultDemo from "./seeds-data/default-demo.json";

/** Bundled demo circles, keyed by id. */
export const SEEDS: Record<string, CircleState> = {
  demo: demo as CircleState,
  "default-demo": defaultDemo as CircleState,
};
