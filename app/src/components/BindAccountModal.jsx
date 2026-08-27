import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../utils/authSession';
import { buildSnapshot, getBindStatus, bindAccount, refreshBackup } from '../utils/cloudAccount';
import { Loader2, X, CloudUpload, ShieldCheck } from 'lucide-react';

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // "Not now" snoozes 7 days
const BIND_INFO_KEY = 'cloud_bind_info';

/** Per-user bookkeeping for the bind prompt: { email, boundAt, lastBackupAt, lastPromptAt, neverAsk } */
export function getBindInfo() {
  try {
    return JSON.parse(localStorage.getItem(BIND_INFO_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBindInfo(info) {
  localStorage.setItem(BIND_INFO_KEY, JSON.stringify(info));
}

/**
 * First-time bind flow (or manual backup from Settings). Shows the signed-in
 * Google identity, uploads a snapshot of the current local data, and records
 * bound email + last-backup time.
 */
export default function BindAccountModal({ mode = 'prompt', onClose }) {
  const { currentUser } = useApp();
  const [phase, setPhase] = useState('form'); // form | uploading | success | error
  const [error, setError] = useState('');
  const [userMeta, setUserMeta] = useState(null);
  const [result, setResult] = useState(null);
  const [existing, setExisting] = useState(null);

  const close = () => {
    if (mode === 'prompt') {
      // Snooze the prompt; a Settings manual backup still works anytime.
      const info = getBindInfo();
      saveBindInfo({ ...info, lastPromptAt: Date.now() });
    }
    if (onClose) onClose();
  };

  const neverAsk = () => {
    saveBindInfo({ ...getBindInfo(), neverAsk: true });
    if (onClose) onClose();
  };

  const start = async () => {
    setPhase('uploading');
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = { email: user?.email || '', name: user?.user_metadata?.full_name || user?.user_metadata?.name || '' };
      setUserMeta(meta);

      const snapshot = buildSnapshot(currentUser);
      const status = await getBindStatus();
      setExisting(status);

      const res = status?.bound
        ? await refreshBackup(snapshot)
        : await bindAccount(snapshot, meta);
      setResult({ ...res, email: meta.email });
      saveBindInfo({
        email: meta.email,
        boundAt: res.backupAt,
        lastBackupAt: res.backupAt,
        lastPromptAt: Date.now(),
        neverAsk: false,
      });
      setPhase('success');
    } catch (e) {
      setError(e.message || 'Could not back up your data.');
      setPhase('error');
    }
  };

  const formatTime = (iso) => {
    if (!iso) return 'never';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 20,
    }}>
      <div className="card slide-up" style={{
        width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16,
        padding: 20, position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <button onClick={close} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
          <X size={20} color="#6B7280" />
        </button>

        {phase === 'form' && (
          <>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#171A21', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <CloudUpload size={22} color="#C6F135" />
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
              {mode === 'prompt' ? 'Back up your data?' : 'Back up to cloud'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7280' }}>
              {mode === 'prompt'
                ? 'Your CaloBit data is only on this phone. Link it to your Google account so a lost or new phone can restore everything — meals, weights, gym, premium.'
                : 'Upload the current data on this phone to your Google account. You can restore it on any device later.'}
            </p>

            {existing?.backupAt && (
              <div style={{ background: '#F3F7EC', border: '1px solid #dbe6c3', borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 12, color: '#5c7017' }}>
                <ShieldCheck size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                Already bound{existing.email ? ` as ${existing.email}` : ''} — last backup {formatTime(existing.backupAt)}. Backing up again updates it.
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%' }} onClick={start}>
              <CloudUpload size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {existing?.bound ? 'Back Up Now' : 'Continue with Google'}
            </button>

            {mode === 'prompt' && (
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button onClick={close} style={{ flex: 1, background: 'none', border: 'none', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '8px 0' }}>
                  Not now
                </button>
                <button onClick={neverAsk} style={{ flex: 1, background: 'none', border: 'none', color: '#9CA3AF', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '8px 0' }}>
                  Don't ask again
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'uploading' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Loader2 size={28} className="spin" color="#14B8A6" />
            <p style={{ margin: '14px 0 0', fontSize: 14, fontWeight: 600 }}>
              {userMeta ? `Backing up as ${userMeta.email}…` : 'Contacting Google…'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF' }}>
              Your meals, weights, gym and premium are being uploaded.
            </p>
          </div>
        )}

        {phase === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#C6F135', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <span style={{ fontSize: 26 }}>✓</span>
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>Backed up!</h3>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#4B5563' }}>
              Your data is safe with {result?.email || 'your Google account'}.
            </p>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: '#9CA3AF' }}>
              Last backup: {formatTime(result?.backupAt)}
            </p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={onClose || close}>
              Done
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 14, color: '#EF4444', fontWeight: 600, marginBottom: 12 }}>⚠️ {error}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={close}>Close</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={start}>Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
