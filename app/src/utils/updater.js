// In-app APK downloader for OTA updates: streams the file with live progress
// into the app's cache, then the caller opens it with FileOpener to trigger
// the Android install prompt. No browser, no "stuck at 29/29 MB".
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const APK_PATH = 'calobit-update.apk';

/**
 * Streams `apkUrl` into the cache directory.
 * @param {string} apkUrl
 * @param {(progress: number) => void} onProgress 0-100 (90 = downloaded,
 *        90-100 covers writing to storage)
 * @returns {{ path: string, directory: Directory }} for FileOpener
 */
export async function downloadApk(apkUrl, onProgress) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('In-app downloads are native-only');
  }

  const res = await fetch(apkUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming not supported on this device');

  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total && onProgress) onProgress(Math.min(90, Math.round((received / total) * 90)));
  }
  if (!received) throw new Error('Downloaded file was empty');

  // Write in ~1 MB base64 chunks — a single 40 MB data-URL can OOM low-end devices.
  await Filesystem.writeFile({
    path: APK_PATH,
    data: '',
    directory: Directory.Cache,
    recursive: true,
  });
  let written = 0;
  for (const chunk of chunks) {
    const b64 = await blobToBase64(new Blob([chunk], { type: 'application/octet-stream' }));
    await Filesystem.appendFile({ path: APK_PATH, data: b64, directory: Directory.Cache });
    written += chunk.length;
    if (total && onProgress) onProgress(Math.min(100, Math.round(90 + (written / total) * 10)));
  }
  return { path: APK_PATH, directory: Directory.Cache };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not encode downloaded file'));
    r.readAsDataURL(blob);
  });
}
