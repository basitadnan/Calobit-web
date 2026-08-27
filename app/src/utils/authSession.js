// Supabase Google sign-in (verified round-trip pattern).
//
// Android: signInWithOAuth({ skipBrowserRedirect: true }) returns a URL that we
// open with @capacitor/browser — a Chrome Custom Tab (in-app browser, not the
// full Chrome app). Google redirects back to Supabase, which redirects to our
// custom scheme com.calobit.app://auth-callback. The app catches that deep link
// (App.addListener('appUrlOpen')), pulls the PKCE code out, and exchanges it
// for a session. Verified end-to-end on an emulator: session persists across
// force-stop + relaunch.
//
// Web: standard Supabase OAuth redirect — no browser plugin, no deep link.
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const AUTH_CALLBACK_URL = 'com.calobit.app://auth-callback';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let listenerRegistered = false;

/**
 * Register the deep-link listener that completes native OAuth.
 * Safe to call multiple times; only registers once.
 * @param {(session: import('@supabase/supabase-js').Session | null) => void} onSession
 */
export function registerDeepLinkHandler(onSession) {
  if (listenerRegistered) return;
  listenerRegistered = true;

  App.addListener('appUrlOpen', async (data) => {
    try {
      // Custom scheme: com.calobit.app://auth-callback?code=... — "auth-callback"
      // is the HOST, not the path, so match the raw prefix (verified pattern).
      if (!String(data.url).startsWith(AUTH_CALLBACK_URL)) return;
      const url = new URL(data.url);
      const code = url.searchParams.get('code');
      if (!code) return;
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[auth] code exchange failed:', error.message);
        return;
      }
      if (onSession) onSession(session);
    } catch (err) {
      console.error('[auth] deep link handling failed:', err);
    }
  });
}

/** Initiate Google sign-in. Native: in-app browser sheet. Web: page redirect. */
export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: AUTH_CALLBACK_URL,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.url) throw new Error('OAuth did not return a redirect URL');
    await Browser.open({ url: data.url });
  } else {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/`,
      },
    });
    if (error) throw new Error(error.message);
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Current session's user id, or ''. */
export function authUserId() {
  return supabase.auth.getSession().then(({ data }) => data.session?.user?.id || '');
}

export function isNative() {
  return Capacitor.isNativePlatform();
}
