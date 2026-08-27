import { useState, useEffect } from 'react';
import { signInWithGoogle } from '../utils/authSession';
import { findLegacyProfiles } from '../utils/migration';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [legacyFound, setLegacyFound] = useState(false);

  useEffect(() => {
    // If this phone already has CaloBit data from before Google sign-in,
    // tell the user up front so they know nothing is lost by signing in.
    try {
      setLegacyFound(findLegacyProfiles().length > 0);
    } catch {}
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      // On Android the in-app browser opens; the session completes via the
      // deep-link handler in AppContext. On web the page redirects.
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in. Check your connection.');
    } finally {
      // On native we stay here until the deep link returns; only clear the
      // spinner when the session actually arrives (AppContext flips currentUser).
      setTimeout(() => setLoading(false), 8000);
    }
  };

  return (
    <div className="page fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F9FAFB', color: '#1A1A1A', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 30, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <img src="logo.png" alt="CaloBit Logo" style={{ width: 70, height: 70, objectFit: 'contain', margin: '0 auto 20px', display: 'block', borderRadius: 16 }} />

        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#1A1A1A', textAlign: 'center' }}>Welcome to CaloBit</h2>
        <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>
          Sign in with Google to keep your data safe — on this phone and in the cloud.
        </p>

        {legacyFound && (
          <div style={{ background: '#F3F7EC', border: '1px solid #dbe6c3', borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 12, color: '#5c7017', textAlign: 'left', lineHeight: 1.5 }}>
            <ShieldCheck size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            We found your existing CaloBit data on this phone. Signing in keeps it — it moves to your Google account and nothing is deleted.
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: '#fff', color: '#1A1A1A', border: '1px solid #D1D5DB', borderRadius: 12,
            padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spin" /> Opening Google…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {error && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 12, textAlign: 'center' }}>⚠️ {error}</p>}

        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 16, textAlign: 'center' }}>
          Your data stays on this phone and is backed up to your Google account.
        </p>
      </div>
    </div>
  );
}
