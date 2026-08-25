import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X, Copy, Check, Timer, Upload, ShieldCheck, PartyPopper,
  AlertCircle, RefreshCw, Loader2, Smartphone,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  createCheckout,
  getCheckoutStatus,
  uploadScreenshot,
  getPendingCheckout,
  savePendingCheckout,
  clearPendingCheckout,
} from '../utils/premium';

const PLAN = 'monthly';
const POLL_MS = 12000;
// How long past its nominal 5-minute expiry a stored checkout stays
// recoverable on reopen (PayGate's sweep flips stale orders within ~2 min).
const RECOVERY_GRACE_MS = 10 * 60 * 1000;
// Consecutive poll failures before the UI says it can't reach the server
// (polling itself never gives up until a terminal state arrives).
const POLL_FAIL_ALERT_AFTER = 5;

/**
 * Full premium checkout flow:
 *   form -> paying (poll /api/checkout/status) -> success
 *              |-> MANUAL_PENDING -> manual screenshot upload (still polling)
 *              |-> EXPIRED/REJECTED -> failed screen -> start over
 * A live order is persisted per-user so closing the app mid-checkout resumes
 * the same PayGate order on return instead of creating a duplicate.
 */
export default function CheckoutModal() {
  const { currentUser, closeCheckout, markPremiumActivated } = useApp();

  const [phase, setPhase] = useState('form');
  const [order, setOrder] = useState(null);
  const [easypaisaName, setEasypaisaName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [remainingMs, setRemainingMs] = useState(0);
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | done | error
  const [pollFailing, setPollFailing] = useState(false);
  const fileRef = useRef(null);
  const pollFailCount = useRef(0);

  // Resume an in-flight checkout for this user. Orders are kept recoverable
  // for a short grace period past their nominal expiry: payment confirmation
  // can land while the app is closed (normal on mobile — users background the
  // app to open their wallet), and discarding the record without asking the
  // server would leave someone who already paid staring at a fresh form.
  useEffect(() => {
    let cancelled = false;
    const pending = getPendingCheckout();
    if (!pending?.orderId) return;

    const expiresAt = new Date(pending.expiresAt).getTime();
    if (expiresAt + RECOVERY_GRACE_MS > Date.now()) {
      setOrder(pending);
      setRemainingMs(Math.max(0, expiresAt - Date.now()));
      setPhase('paying');
      return;
    }

    // Long-stale order: ask the server once whether it ended up PAID before
    // throwing the record away.
    getCheckoutStatus(pending.orderId)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'PAID') {
          markPremiumActivated(pending.orderId, pending.plan || PLAN);
          clearPendingCheckout();
          setPhase('success');
        } else if (res.status === 'MANUAL_PENDING') {
          // Payment likely made but awaiting review — keep it alive.
          setOrder(pending);
          setRemainingMs(0);
          setUploadState(pending.screenshotUploaded ? 'done' : 'idle');
          setPhase('manual');
        } else {
          clearPendingCheckout();
        }
      })
      .catch(() => {
        if (!cancelled) clearPendingCheckout();
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Payment status polling — runs while waiting or under manual review,
  // stops once a terminal state (PAID / EXPIRED) is reached.
  useEffect(() => {
    if (!order?.orderId || (phase !== 'paying' && phase !== 'manual')) return;
    let cancelled = false;
    let timer;

    const tick = async () => {
      let status;
      try {
        const res = await getCheckoutStatus(order.orderId);
        status = res.status;
        pollFailCount.current = 0;
        setPollFailing(false);
      } catch {
        // Transient network/API hiccup — keep trying, but tell the user if it
        // keeps failing instead of sitting silently on "waiting".
        pollFailCount.current += 1;
        if (pollFailCount.current >= POLL_FAIL_ALERT_AFTER) setPollFailing(true);
        return;
      }
      if (cancelled) return;

      if (status === 'PAID') {
        markPremiumActivated(order.orderId, order.plan || PLAN);
        clearPendingCheckout();
        setPhase('success');
      } else if (status === 'MANUAL_PENDING') {
        if (phase === 'paying') setPhase('manual');
      } else if (status === 'EXPIRED' || status === 'REJECTED') {
        clearPendingCheckout();
        setError(
          status === 'EXPIRED'
            ? 'This payment order expired. Please start again.'
            : 'Your payment could not be verified. Please contact support or start again.'
        );
        setPhase('failed');
      }
    };

    tick();
    timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [order?.orderId, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cosmetic countdown — PayGate's backend is the real timeout authority.
  useEffect(() => {
    if (!order?.expiresAt || (phase !== 'paying' && phase !== 'manual')) return;
    const expiresAt = new Date(order.expiresAt).getTime();
    const update = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [order?.expiresAt, phase]);

  // QR code for scan-to-pay from the user's own wallet app.
  useEffect(() => {
    if (!order?.easypaisaNumber || (phase !== 'paying' && phase !== 'manual')) return;
    QRCode.toDataURL(
      `Send Rs. ${order.amount} via Easypaisa to ${order.easypaisaNumber}`,
      { margin: 1, width: 220 }
    )
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [order?.easypaisaNumber, order?.amount, phase]);

  const handlePayNow = async () => {
    if (!easypaisaName.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const data = await createCheckout(PLAN, easypaisaName.trim());
      const info = {
        orderId: data.order_id,
        amount: data.amount,
        expiresAt: data.expires_at,
        plan: PLAN,
        easypaisaNumber: data.easypaisa_number,
        easypaisaAccountName: data.easypaisa_account_name,
      };
      savePendingCheckout(info);
      setOrder(info);
      setRemainingMs(new Date(info.expiresAt).getTime() - Date.now());
      setPhase('paying');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleScreenshot = async (file) => {
    if (!file || !order?.orderId || uploadState === 'uploading') return;
    setUploadState('uploading');
    setError('');
    try {
      await uploadScreenshot(order.orderId, file);
      setUploadState('done');
      // Remember across app restarts so recovery shows the received state.
      savePendingCheckout({ ...order, screenshotUploaded: true });
    } catch (err) {
      setUploadState('error');
      setError(err.message);
    }
  };

  const copyValue = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for WebViews without async clipboard permission
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const startOver = () => {
    clearPendingCheckout();
    setOrder(null);
    setUploadState('idle');
    setError('');
    setPollFailing(false);
    pollFailCount.current = 0;
    setPhase('form');
  };

  if (!currentUser) return null;
  const minutes = Math.floor(Math.max(0, remainingMs) / 60000);
  const seconds = Math.floor((Math.max(0, remainingMs) % 60000) / 1000);

  return (
    <div className="fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 20,
    }}>
      <div className="card slide-up" style={{
        width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16, padding: 20, position: 'relative',
      }}>
        <button onClick={closeCheckout} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={20} color="#6B7280" />
        </button>

        {phase === 'form' && (
          <FormStep
            easypaisaName={easypaisaName}
            setEasypaisaName={setEasypaisaName}
            onPay={handlePayNow}
            creating={creating}
            error={error}
          />
        )}

        {(phase === 'paying' || phase === 'manual') && order && (
          <PayStep
            order={order}
            qrDataUrl={qrDataUrl}
            copied={copied}
            onCopy={copyValue}
            minutes={minutes}
            seconds={seconds}
            expiredCountdown={remainingMs <= 0}
          />
        )}

        {phase === 'manual' && (
          <ManualStep
            uploadState={uploadState}
            error={error}
            onFile={(f) => handleScreenshot(f)}
            fileRef={fileRef}
          />
        )}

        {phase === 'paying' && error && <ErrorText>{error}</ErrorText>}
        {(phase === 'paying' || phase === 'manual') && pollFailing && (
          <ErrorText>Can't reach the payment service right now — retrying automatically…</ErrorText>
        )}

        {phase === 'success' && <SuccessStep onClose={closeCheckout} />}

        {phase === 'failed' && (
          <FailedStep error={error} onStartOver={startOver} />
        )}
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */

function FormStep({ easypaisaName, setEasypaisaName, onPay, creating, error }) {
  return (
    <>
      <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Upgrade to Premium</p>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
        Support Calobit's development and unlock premium features.
      </p>

      <div style={{
        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#88a31e' }}>Rs. 100</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>per month</span>
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: 13, color: '#374151', lineHeight: 2 }}>
        <li><Check size={14} color="#88a31e" style={{ verticalAlign: '-2px', marginRight: 8 }} />All premium features unlocked</li>
        <li><Check size={14} color="#88a31e" style={{ verticalAlign: '-2px', marginRight: 8 }} />Pay from any wallet — Easypaisa, JazzCash, NayaPay, SadaPay or bank</li>
        <li><Check size={14} color="#88a31e" style={{ verticalAlign: '-2px', marginRight: 8 }} />Automatic verification within minutes</li>
      </ul>

      <div className="form-group">
        <label>Your Easypaisa-registered account name</label>
        <input
          className="input-field"
          placeholder="e.g. Ali Raza"
          value={easypaisaName}
          onChange={(e) => setEasypaisaName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onPay()}
        />
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
          The name shown when you send money — it's how your payment is matched.
        </p>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <button className="btn-primary" onClick={onPay} disabled={creating || !easypaisaName.trim()} style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
        {creating ? <Loader2 size={16} className="spin" /> : <Smartphone size={16} />}
        {creating ? 'Creating order…' : 'Pay Now'}
      </button>

      <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>
        <ShieldCheck size={13} /> Payments are verified automatically — no screenshots unless something goes wrong.
      </p>
    </>
  );
}

function PayStep({ order, qrDataUrl, copied, onCopy, minutes, seconds, expiredCountdown }) {
  return (
    <>
      <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Complete Your Payment</p>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
        Send exactly this amount to the number below from any wallet or bank app.
      </p>

      <div style={{ textAlign: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Amount to send</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.2 }}>Rs. {order.amount}</p>
      </div>

      <CopyRow
        label="number"
        title="Easypaisa number"
        value={order.easypaisaNumber || '—'}
        copied={copied === 'number'}
        onCopy={() => onCopy('number', order.easypaisaNumber)}
      />
      {order.easypaisaAccountName && (
        <CopyRow
          label="name"
          title="Account name"
          value={order.easypaisaAccountName}
          copied={copied === 'name'}
          onCopy={() => onCopy('name', order.easypaisaAccountName)}
        />
      )}

      {qrDataUrl && (
        <div style={{ textAlign: 'center', margin: '14px 0 4px' }}>
          <img src={qrDataUrl} alt="Scan to pay" style={{ width: 150, height: 150, borderRadius: 8 }} />
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Scan from your wallet app</p>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: 14, padding: '10px 12px', borderRadius: 10,
        background: '#F3F7EC',
      }}>
        {expiredCountdown ? (
          <>
            <Loader2 size={15} className="spin" color="#88a31e" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5c7017' }}>Finalizing… almost done</span>
          </>
        ) : (
          <>
            <Timer size={15} color="#88a31e" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5c7017' }}>
              Waiting for payment · {minutes}:{String(seconds).padStart(2, '0')}
            </span>
          </>
        )}
      </div>

      <ol style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.7, paddingLeft: 18, marginTop: 12 }}>
        <li>Open your wallet / banking app and send exactly Rs. {order.amount} to the number above.</li>
        <li>Keep this screen open — confirmation usually lands within a minute of sending.</li>
      </ol>
    </>
  );
}

function ManualStep({ uploadState, error, onFile }) {
  return (
    <>
      <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>Upload Payment Screenshot</p>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
        We couldn't verify your payment automatically. Upload a screenshot of your
        transfer receipt and our team will review it shortly.
      </p>

      {uploadState === 'done' ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, background: '#F3F7EC',
          border: '1px solid #dbe6c3', borderRadius: 12, padding: 14,
        }}>
          <Check size={20} color="#88a31e" />
          <p style={{ fontSize: 13, color: '#5c7017', fontWeight: 600, lineHeight: 1.5 }}>
            Received! Your payment is under review — you'll be upgraded as soon as it's approved.
          </p>
        </div>
      ) : (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          border: '2px dashed #D1D5DB', borderRadius: 12, padding: '24px 16px',
          cursor: 'pointer', textAlign: 'center',
        }}>
          {uploadState === 'uploading'
            ? <Loader2 size={22} className="spin" color="#88a31e" />
            : <Upload size={22} color="#88a31e" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            {uploadState === 'uploading' ? 'Uploading…' : 'Tap to choose a screenshot'}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>PNG or JPG, up to 4 MB</span>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
}

function SuccessStep({ onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', background: '#F3F7EC',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
      }}>
        <PartyPopper size={30} color="#88a31e" />
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>You're Premium! 🎉</p>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
        Payment confirmed — all premium features are unlocked on this account. Thank you for supporting Calobit!
      </p>
      <button className="btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
        Start exploring
      </button>
    </div>
  );
}

function FailedStep({ error, onStartOver }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
      }}>
        <AlertCircle size={26} color="#EF4444" />
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Payment not completed</p>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 1.6 }}>{error}</p>
      <button className="btn-primary" onClick={onStartOver} style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
        <RefreshCw size={15} /> Start over
      </button>
    </div>
  );
}

/* ---------- Bits ---------- */

function CopyRow({ title, value, copied, onCopy }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginBottom: 8,
    }}>
      <div>
        <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{title}</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', userSelect: 'all' }}>{value}</p>
      </div>
      <button
        onClick={onCopy}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: copied ? '#88a31e' : '#6B7280', fontSize: 12, fontWeight: 600 }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function ErrorText({ children }) {
  return (
    <p style={{ fontSize: 12, color: '#EF4444', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>
      {children}
    </p>
  );
}
