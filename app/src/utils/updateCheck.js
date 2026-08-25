// In-app update check.
//
// The app fetches a tiny version manifest from the deployed web host and
// compares its versionCode against the installed build's. When the manifest is
// newer, the UI surfaces an "update available" banner with the changelog and a
// download link. The check is fully optional — offline, unreachable hosts, or
// an unconfigured URL simply skip it.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const CHECK_TIMEOUT_MS = 8000;

// Prefer the explicitly configured update URL (set VITE_UPDATE_URL when
// building the app for distribution). On the web the manifest lives next to
// the bundle, so the page's own origin works; in the native WebView the origin
// is a local server, so an explicit URL is required.
const NATIVE_UPDATE_URL = (import.meta.env.VITE_UPDATE_URL || '').trim();

function versionUrl() {
  if (NATIVE_UPDATE_URL) return NATIVE_UPDATE_URL;
  if (!Capacitor.isNativePlatform()) return `${window.location.origin}/version.json`;
  return '';
}

/** Returns update info if a newer build exists, otherwise null. Never throws. */
export async function checkForUpdate() {
  // The web build is deployed by us and is therefore always the latest —
  // update checks and the minimum-version gate only apply to native installs
  // (a browser has no installed build number, so the gate would brick it).
  if (!Capacitor.isNativePlatform()) return null;

  const url = versionUrl();
  if (!url || !navigator.onLine) return null;

  let localCode = 0;
  try {
    const info = await App.getInfo();
    localCode = Number(info.build) || 0;
  } catch {
    return null;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const manifest = await res.json();
    const remoteCode = Number(manifest.versionCode) || 0;
    // minVersionCode is the kill switch: when the installed build is older,
    // the app is gated behind an update no matter what. Bump it in the
    // manifest to remotely retire any build that ships with this check.
    const minCode = Number(manifest.minVersionCode) || 0;
    const updateRequired = minCode > 0 && localCode < minCode;
    if (remoteCode <= localCode && !updateRequired) return null;
    // Resolve relative apkUrl against the MANIFEST's origin — inside the
    // native WebView window.location.origin is capacitor://localhost, which
    // would produce a dead link.
    const apkUrl = manifest.apkUrl ? new URL(manifest.apkUrl, url).href : '';
    return {
      versionCode: remoteCode,
      versionName: manifest.versionName || '',
      notes: manifest.notes || '',
      apkUrl,
      updateRequired,
    };
  } catch {
    return null;
  }
}