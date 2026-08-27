import { X } from 'lucide-react';

/**
 * First-time Google sign-in: pick which existing local profile belongs to
 * this Google account. That profile's data (meals, weights, gym, premium, …)
 * is migrated into the new user-ID scope — the "bind account" step.
 */
export default function LegacyProfilePicker({ profiles, onSelect, onSkip }) {
  return (
    <div className="fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1300, padding: 20,
    }}>
      <div className="card slide-up" style={{
        width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16,
        padding: 20, position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <button onClick={onSkip} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
          <X size={20} color="#6B7280" />
        </button>

        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#171A21', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ color: '#C6F135', fontWeight: 800, fontSize: 20 }}>🔗</span>
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
          Link your data to Google?
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7280' }}>
          You already have a CaloBit profile saved on this phone. Pick which one belongs to
          this Google account — its meals, weights, gym and premium will follow you here.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {profiles.map((p) => (
            <button
              key={p.username || 'guest'}
              onClick={() => onSelect(p.username)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                padding: '12px 14px', borderRadius: 12, border: '1px solid #E5E7EB',
                background: '#fff', cursor: 'pointer', width: '100%',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#4B5563', fontSize: 14, flexShrink: 0,
              }}>
                {(p.name || '?').charAt(0).toUpperCase()}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>{p.name}</span>
                {p.username && (
                  <span style={{ display: 'block', fontSize: 12, color: '#9CA3AF' }}>@{p.username}</span>
                )}
              </span>
              <span style={{ color: '#14B8A6', fontWeight: 700, fontSize: 18 }}>→</span>
            </button>
          ))}
        </div>

        <button
          onClick={onSkip}
          style={{
            width: '100%', padding: '12px 0', background: 'none', border: 'none',
            color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Start fresh — don't link anything
        </button>
      </div>
    </div>
  );
}
