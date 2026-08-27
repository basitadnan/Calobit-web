// Legacy local-profile migration ("binding").
//
// Before v1.8, Calobit had local username/password profiles scoped as
// calobit_<username>_<key>. After Google sign-in, the active scope becomes
// calobit_<supabaseUserId>_<key>. When an existing user signs in with Google
// for the first time, we offer a picker of their old local profiles and move
// the chosen profile's data (meals, weights, gym, premium, …) into the new
// user-ID scope. That is the "bind account" step: local data attaches to the
// Google identity.

import { getUsers } from './storage';

const MIGRATED_KEY_PREFIX = 'calobit_migrated_';

/** Every per-user key in a scope: calobit_<scope>_<key>. */
function scopedKeys(scope) {
  if (!scope) return [];
  const prefix = `calobit_${scope}_`;
  return Object.keys(localStorage).filter((k) => k.startsWith(prefix));
}

/**
 * Legacy profiles available to bind, from the old registry + any unscoped
 * guest data. Returns [{ name, username }] where username '' = guest data.
 */
export function findLegacyProfiles() {
  const found = [];
  try {
    for (const u of getUsers()) {
      if (scopedKeys(u.username).length > 0) {
        found.push({ name: u.name || u.username, username: u.username });
      }
    }
  } catch {}
  // Unscoped guest keys (calobit_profile etc.) from the pre-profile era.
  const guestKeys = Object.keys(localStorage).filter(
    (k) => k.startsWith('calobit_') && !k.startsWith('calobit_users') && !/^calobit_[^_]+_/.test(k) && k !== 'calobit_current_user'
  );
  // A "guest" key is unscoped (no calobit_<x>_ segment).
  const unscoped = guestKeys.filter((k) => !/^calobit_.+_.+$/.test(k));
  if (unscoped.length > 0) {
    found.push({ name: 'Guest data (old device data)', username: '' });
  }
  return found;
}

/** True when this Google user has already completed (or skipped) binding. */
export function hasMigrated(userId) {
  return localStorage.getItem(`${MIGRATED_KEY_PREFIX}${userId}`) !== null;
}

/** Mark the binding decision for a Google user ('' = skipped). */
export function markMigrated(userId, legacyUsername) {
  localStorage.setItem(`${MIGRATED_KEY_PREFIX}${userId}`, legacyUsername || '');
}

/**
 * Move a legacy profile's keys into the new user-ID scope. Existing new-scope
 * keys win (never overwrite fresh data). Premium is a named sub-step: the
 * calobit_<username>_premium key is copied like any other, and callers assert
 * isPremiumActive() afterwards (see migration test in Settings).
 */
export function migrateLegacyProfile(legacyUsername, userId) {
  const srcKeys = legacyUsername
    ? scopedKeys(legacyUsername)
    : Object.keys(localStorage).filter(
        (k) => k.startsWith('calobit_') && !/^calobit_.+_.+$/.test(k) && k !== 'calobit_current_user' && k !== 'calobit_users'
      );

  let copied = 0;
  for (const key of srcKeys) {
    const suffix = legacyUsername ? key.slice(`calobit_${legacyUsername}_`.length) : key.slice('calobit_'.length);
    const dest = `calobit_${userId}_${suffix}`;
    if (localStorage.getItem(dest) === null) {
      localStorage.setItem(dest, localStorage.getItem(key));
      copied++;
    }
    localStorage.removeItem(key);
  }

  // Remove the bound profile from the old registry so it stops appearing.
  if (legacyUsername) {
    try {
      const users = getUsers().filter((u) => u.username !== legacyUsername);
      localStorage.setItem('calobit_users', JSON.stringify(users));
    } catch {}
  }

  markMigrated(userId, legacyUsername);
  return copied;
}
