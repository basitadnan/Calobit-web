// Cloud backup/restore via Supabase.
//
// The signed-in user's localStorage scope (calobit_<userId>_*) is snapshotted
// into the `user_backups` table, keyed by the same Supabase user ID. RLS
// policies on that table only allow auth.uid() to read/write their own row,
// so the client never touches another user's data and no backend route is
// needed (Supabase validates the session token via PostgREST/RLS).
//
// `pending_checkout` is excluded (volatile in-flight state).
import { supabase } from './authSession';
import { getActiveUser } from './storage';

const BOUND_TABLE = 'bound_accounts';
const BACKUP_TABLE = 'user_backups';
const MAX_BACKUP_BYTES = 2 * 1024 * 1024; // 2 MB cap (serverless-friendly)
const EXCLUDED_SUFFIXES = ['pending_checkout'];

/** All keys in the active user's scope, minus volatile ones. */
export function buildSnapshot(userId = getActiveUser()) {
  if (!userId) return null;
  const prefix = `calobit_${userId}_`;
  const data = {};
  let bytes = 0;
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    if (EXCLUDED_SUFFIXES.includes(suffix)) continue;
    const value = localStorage.getItem(key);
    data[suffix] = value;
    bytes += value ? value.length : 0;
  }
  return { data, bytes, createdAt: new Date().toISOString() };
}

/**
 * Apply a snapshot to the current user's scope. Returns a summary.
 * Never overwrites `pending_checkout`.
 */
export function applySnapshot(snapshot, userId = getActiveUser()) {
  if (!snapshot || !userId) return { applied: 0 };
  const prefix = `calobit_${userId}_`;
  let applied = 0;
  for (const [suffix, value] of Object.entries(snapshot.data || {})) {
    if (EXCLUDED_SUFFIXES.includes(suffix)) continue;
    localStorage.setItem(prefix + suffix, value);
    applied++;
  }
  return { applied };
}

// --- API (Supabase PostgREST, RLS-scoped to auth.uid()) ---

/** { bound, email, displayName, backupAt, bytes } or null when never bound. */
export async function getBindStatus() {
  const { data: bound, error: bErr } = await supabase
    .from(BOUND_TABLE)
    .select('email, display_name, last_seen_at')
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!bound) return null;

  const { data: backup, error: kErr } = await supabase
    .from(BACKUP_TABLE)
    .select('updated_at, bytes')
    .maybeSingle();
  if (kErr) throw new Error(kErr.message);

  return {
    bound: true,
    email: bound.email,
    displayName: bound.display_name,
    backupAt: backup?.updated_at || null,
    bytes: backup?.bytes || 0,
  };
}

/** First-time bind: record the identity + store the snapshot. */
export async function bindAccount(snapshot, userMeta) {
  if (snapshot && snapshot.bytes > MAX_BACKUP_BYTES) {
    throw new Error('Backup is too large to store (2 MB limit).');
  }

  const email = userMeta?.email || '';
  const displayName = userMeta?.name || '';

  const { error: bErr } = await supabase
    .from(BOUND_TABLE)
    .upsert({ email, display_name: displayName, last_seen_at: new Date().toISOString() });
  if (bErr) throw new Error(bErr.message);

  if (snapshot) {
    const { error: kErr } = await supabase
      .from(BACKUP_TABLE)
      .upsert({ data: snapshot.data, bytes: snapshot.bytes, updated_at: new Date().toISOString() });
    if (kErr) throw new Error(kErr.message);
  }

  return { ok: true, email, backupAt: new Date().toISOString() };
}

/** Silent refresh: requires an existing binding. */
export async function refreshBackup(snapshot) {
  if (snapshot && snapshot.bytes > MAX_BACKUP_BYTES) {
    throw new Error('Backup is too large to store (2 MB limit).');
  }
  const { data: bound } = await supabase.from(BOUND_TABLE).select('email').maybeSingle();
  if (!bound) throw new Error('Not bound. Sign in and bind your account first.');

  if (snapshot) {
    const { error: kErr } = await supabase
      .from(BACKUP_TABLE)
      .upsert({ data: snapshot.data, bytes: snapshot.bytes, updated_at: new Date().toISOString() });
    if (kErr) throw new Error(kErr.message);
  }
  return { ok: true, backupAt: new Date().toISOString() };
}

/** Return the stored backup snapshot (data + bytes), or null. */
export async function fetchBackup() {
  const { data, error } = await supabase
    .from(BACKUP_TABLE)
    .select('data, bytes, updated_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { data: data.data, bytes: data.bytes, updatedAt: data.updated_at };
}
