import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { checkForUpdate } from '../utils/updateCheck';
import { downloadApk } from '../utils/updater';

// One update prompt per app session — a dismissed banner stays gone until the
// next launch, so the check doesn't nag during normal use.
let sessionDismissed = false;

export default function UpdateBanner() {
  const [update, setUpdate] = useState(null);
  // null = idle; { progress } while the in-app download runs.
  const [download, setDownload] = useState(null);
  const [dlError, setDlError] = useState('');

  const runCheck = () => {
    if (sessionDismissed) return;
    checkForUpdate().then(u => {
      if (u && !sessionDismissed) setUpdate(u);
    });
  };

  useEffect(() => {
    runCheck();
    let unsub;
    // Re-check when the app returns to the foreground (e.g. after the user
    // installed the APK and came back).
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) runCheck();
    }).then(r => { unsub = r; });
    return () => { if (unsub) unsub.then(u => u.remove()); };
  }, []);

  if (!update) return null;

  const dismiss = () => {
    sessionDismissed = true;
    setUpdate(null);
  };

  /**
   * Native: download the APK in-app with a progress bar, then hand it to the
   * Android installer — no browser, no "stuck at 29/29 MB". Web: the browser
   * handles the download itself (the web build is always current anyway).
   */
  const startDownload = async () => {
    if (!update.apkUrl || download) return;

    if (!Capacitor.isNativePlatform()) {
      window.open(update.apkUrl, '_blank');
      if (!update.updateRequired) dismiss();
      return;
    }

    setDlError('');
    setDownload({ progress: 0 });
    try {
      const file = await downloadApk(update.apkUrl, (p) => setDownload({ progress: p }));
      setDownload({ progress: 100 });
      // Hands the file to Android's package installer — the system takes over.
      // The plugin expects an absolute file URI + `filePath`/`contentType`.
      const { uri } = await Filesystem.getUri({ path: file.path, directory: file.directory });
      await FileOpener.open({
        filePath: uri,
        contentType: 'application/vnd.android.package-archive',
      });
      // The dismissable banner goes away; the required gate stays up until the
      // user actually updates and relaunches.
      if (!update.updateRequired) dismiss();
      setTimeout(() => setDownload(null), 1500);
    } catch (e) {
      setDownload(null);
      setDlError(e.message || 'Download failed — try again');
    }
  };

  const downloadUi = download ? (
    <div style={{ marginTop: 14 }}>
      <div style={{ background: '#E5E7EB', borderRadius: 8, height: 14, overflow: 'hidden' }}>
        <div style={{
          width: `${download.progress}%`, background: '#C6F135', height: '100%',
          transition: 'width 0.25s ease',
        }} />
      </div>
      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6, textAlign: 'center', margin: '6px 0 0' }}>
        {download.progress < 90 ? `Downloading update… ${download.progress}%` : 'Preparing installer…'}
      </p>
    </div>
  ) : null;

  const errorUi = dlError ? (
    <p style={{ fontSize: 12, color: '#EF4444', margin: '10px 0 0', textAlign: 'center' }}>{dlError}</p>
  ) : null;

  // Remote kill switch: when the manifest marks this build below the minimum
  // version, the gate is non-dismissable — the app can't be used until updated.
  if (update.updateRequired) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100000, background: '#171A21',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', color: '#fff' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#C6F135', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ color: '#171A21', fontWeight: 800, fontSize: 24 }}>⚡</span>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>Update required</h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#9CA3AF', whiteSpace: 'pre-wrap' }}>
            {update.notes || 'This version of CaloBit is no longer supported. Update to the latest version to continue.'}
          </p>
          {update.apkUrl && (
            <button
              onClick={startDownload}
              disabled={!!download}
              style={{
                width: '100%', background: '#C6F135', color: '#171A21', border: 'none',
                borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                opacity: download ? 0.7 : 1,
              }}
            >
              {download ? `Downloading… ${download.progress}%` : 'Update CaloBit Now'}
            </button>
          )}
          {downloadUi}
          {errorUi}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={download ? undefined : dismiss}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#171A21', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ color: '#C6F135', fontWeight: 800, fontSize: 20 }}>⚡</span>
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
          Update available {update.versionName ? `· v${update.versionName}` : ''}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'pre-wrap' }}>
          {update.notes || 'A new version of CaloBit is ready.'}
        </p>

        {download ? (
          downloadUi
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={startDownload}
              style={{
                flex: 1, background: '#C6F135', color: '#171A21', border: 'none',
                borderRadius: 10, padding: '12px 0', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}
            >
              Update Now
            </button>
            <button
              onClick={dismiss}
              style={{
                background: 'none', border: '1px solid #E5E7EB', color: '#6B7280',
                borderRadius: 10, padding: '0 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        )}
        {errorUi}
      </div>
    </div>
  );
}
