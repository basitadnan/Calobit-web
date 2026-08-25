// Client-side premium + checkout helpers.
//
// Calobit is local-first: accounts live in localStorage. Premium state is a
// per-user localStorage flag that gets set when our own backend confirms the
// PayGate order is PAID (the frontend never talks to PayGate directly — the
// PayGate URL/key only exist server-side inside /api/checkout/*).
import { Capacitor } from '@capacitor/core';

const PREMIUM_KEY = 'premium';
const PENDING_CHECKOUT_KEY = 'pending_checkout';
// Fallback for native builds where there is no same-origin API; override with
// VITE_CHECKOUT_API_BASE at build time if the deploy domain ever changes.
const FALLBACK_NATIVE_BASE = 'https://calobit.vercel.app';

function scopedKey(key) {
  const username = localStorage.getItem('calobit_current_user') || '';
  return username ? `calobit_${username}_${key}` : `calobit_${key}`;
}

/** Base URL for /api/checkout/* calls ('' = same-origin on the web). */
export function checkoutApiBase() {
  const configured = (import.meta.env.VITE_CHECKOUT_API_BASE || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (!Capacitor.isNativePlatform()) return '';
  return FALLBACK_NATIVE_BASE;
}

export function isPremiumActive() {
  try {
    const data = JSON.parse(localStorage.getItem(scopedKey(PREMIUM_KEY)));
    return Boolean(data && data.active);
  } catch {
    return false;
  }
}

export function activatePremium(orderId, plan) {
  localStorage.setItem(
    scopedKey(PREMIUM_KEY),
    JSON.stringify({ active: true, orderId, plan, since: new Date().toISOString() })
  );
}

// --- In-flight checkout persistence (resume after tab close/reopen) ---

export function getPendingCheckout() {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(PENDING_CHECKOUT_KEY)));
  } catch {
    return null;
  }
}

/** data: { orderId, amount, expiresAt, plan, easypaisaNumber, easypaisaAccountName } */
export function savePendingCheckout(data) {
  localStorage.setItem(scopedKey(PENDING_CHECKOUT_KEY), JSON.stringify(data));
}

export function clearPendingCheckout() {
  localStorage.removeItem(scopedKey(PENDING_CHECKOUT_KEY));
}

// --- Backend proxy calls ---

async function parseJson(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function createCheckout(plan, easypaisaName) {
  const username = localStorage.getItem('calobit_current_user') || '';
  const res = await fetch(`${checkoutApiBase()}/api/checkout/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, easypaisa_name: easypaisaName, user_id: username }),
  });
  return parseJson(res);
}

export async function getCheckoutStatus(orderId) {
  const res = await fetch(
    `${checkoutApiBase()}/api/checkout/status?order_id=${encodeURIComponent(orderId)}`
  );
  return parseJson(res);
}

/**
 * Compress a screenshot to fit serverless body limits, then upload it.
 */
export async function uploadScreenshot(orderId, file) {
  const blob = await compressImage(file, 1600, 0.85);

  const form = new FormData();
  form.append('file', blob, 'screenshot.jpg');
  form.append('order_id', orderId);

  const res = await fetch(
    `${checkoutApiBase()}/api/checkout/screenshot?order_id=${encodeURIComponent(orderId)}`,
    { method: 'POST', body: form }
  );
  return parseJson(res);
}

function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image'));
    };
    img.src = objectUrl;
  });
}
