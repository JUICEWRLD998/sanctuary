/**
 * lib/store.ts — the persistence backend behind lib/ledger.
 *
 * Sanctuary's MVP persisted each circle as a JSON file under data/circles/.
 * That works locally and for the committed demo seeds, but Vercel's serverless
 * filesystem is read-only and ephemeral, so writes (create / join / advance)
 * must go to a durable store. This module provides that store with two backends,
 * chosen at runtime by whether DATABASE_URL is set:
 *
 *   • Neon (Postgres over HTTP) — production. A single `circles` table of
 *     (id TEXT PRIMARY KEY, state JSONB). The serverless driver needs no
 *     connection pool, so it's safe in a per-request serverless function.
 *   • Filesystem — local dev + the `tsx` scripts. Unchanged behaviour: one
 *     JSON file per circle under data/circles/.
 *
 * Reads also fall back to the bundled demo SEEDS (lib/seeds) so the read-only
 * proof circles (/circle/demo) work in production without any DB rows.
 *
 * lib/ledger re-exports these under its original function names, so every
 * existing caller (engines + API routes) is untouched.
 *
 * SERVER-ONLY.
 */
import type { CircleState } from "./ledger-types";
import { SEEDS } from "./seeds";

/** True when a Neon/Postgres connection string is configured. */
function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function assertValidId(id: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new Error(`Invalid circle id: ${JSON.stringify(id)}`);
  }
}

// ── Neon backend ────────────────────────────────────────────────────────────
// The client + schema bootstrap are created lazily and memoised so we pay the
// cost once per warm serverless instance, never at module load (which would
// break the filesystem/dev path that has no DATABASE_URL).

type NeonClient = ReturnType<typeof import("@neondatabase/serverless").neon>;

let sqlClient: NeonClient | null = null;
let schemaReady: Promise<void> | null = null;

async function getSql(): Promise<NeonClient> {
  if (!sqlClient) {
    const { neon } = await import("@neondatabase/serverless");
    sqlClient = neon(process.env.DATABASE_URL as string);
  }
  if (!schemaReady) {
    const sql = sqlClient!;
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS circles (
        id    TEXT PRIMARY KEY,
        state JSONB NOT NULL
      )
    `.then(() => undefined);
  }
  await schemaReady;
  return sqlClient!;
}

// The neon() tagged template returns a union (plain rows vs FullQueryResults)
// depending on options. We use the default (plain rows) everywhere, so narrow
// each result to a rows array through this helper.
function asRows(result: unknown): Record<string, unknown>[] {
  return result as Record<string, unknown>[];
}

async function dbLoad(id: string): Promise<CircleState | null> {
  const sql = await getSql();
  const rows = asRows(await sql`SELECT state FROM circles WHERE id = ${id}`);
  if (rows.length === 0) return null;
  return rows[0].state as CircleState;
}

async function dbSave(state: CircleState): Promise<void> {
  const sql = await getSql();
  await sql`
    INSERT INTO circles (id, state) VALUES (${state.id}, ${JSON.stringify(state)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state
  `;
}

async function dbList(): Promise<string[]> {
  const sql = await getSql();
  const rows = asRows(await sql`SELECT id FROM circles`);
  return rows.map((r) => r.id as string);
}

async function dbDelete(id: string): Promise<void> {
  const sql = await getSql();
  await sql`DELETE FROM circles WHERE id = ${id}`;
}

// ── Filesystem backend (local dev + scripts) ────────────────────────────────
// Imported lazily so `fs`/`path` never load in a serverless/edge context that
// uses the DB backend.

async function fsModule() {
  const { promises: fs } = await import("fs");
  const path = await import("path");
  const DATA_DIR = path.join(process.cwd(), "data", "circles");
  return { fs, path, DATA_DIR };
}

async function fileLoad(id: string): Promise<CircleState | null> {
  const { fs, path, DATA_DIR } = await fsModule();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as CircleState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function fileSave(state: CircleState): Promise<void> {
  const { fs, path, DATA_DIR } = await fsModule();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${state.id}.json`), JSON.stringify(state, null, 2), "utf8");
}

async function fileList(): Promise<string[]> {
  const { fs, DATA_DIR } = await fsModule();
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function fileDelete(id: string): Promise<void> {
  const { fs, path, DATA_DIR } = await fsModule();
  try {
    await fs.unlink(path.join(DATA_DIR, `${id}.json`));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

// ── Public store API (backend-agnostic) ─────────────────────────────────────

/**
 * Load a circle by id. Resolution order:
 *   1. the active backend (DB in prod, file locally) — dynamic circles;
 *   2. the bundled demo SEEDS — read-only proof circles, always available.
 * A stored copy always wins over a seed (so a seed id could be re-driven), but
 * in practice seed ids and dynamic ids never collide.
 */
export async function storeLoad(id: string): Promise<CircleState | null> {
  assertValidId(id);
  const stored = hasDatabase() ? await dbLoad(id) : await fileLoad(id);
  if (stored) return stored;
  const seed = SEEDS[id];
  return seed ? (JSON.parse(JSON.stringify(seed)) as CircleState) : null;
}

/** Persist a circle, stamping `updatedAt`. */
export async function storeSave(state: CircleState): Promise<CircleState> {
  assertValidId(state.id);
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (hasDatabase()) await dbSave(next);
  else await fileSave(next);
  return next;
}

/** All known circle ids: stored rows/files unioned with the bundled seeds. */
export async function storeList(): Promise<string[]> {
  const stored = hasDatabase() ? await dbList() : await fileList();
  return Array.from(new Set([...stored, ...Object.keys(SEEDS)]));
}

/** Delete a circle from the active backend. Seeds are read-only and untouched. */
export async function storeDelete(id: string): Promise<void> {
  assertValidId(id);
  if (hasDatabase()) await dbDelete(id);
  else await fileDelete(id);
}
