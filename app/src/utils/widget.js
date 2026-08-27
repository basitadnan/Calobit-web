// Home-screen widget bridge (native only).
//
// The web layer pushes a small snapshot of today's calories + macros; the
// native CaloBitWidgetPlugin stores it in SharedPreferences and re-renders
// every widget instance. On web this is a no-op.
import { Capacitor } from '@capacitor/core';

export function updateWidget(data) {
  if (!Capacitor.isNativePlatform()) return;
  const plugin = Capacitor.Plugins?.CaloBitWidget;
  if (!plugin) return;
  try {
    plugin.update({
      calories: Math.round(data.calories || 0),
      remaining: Math.round(data.remaining || 0),
      protein: Math.round(data.protein || 0),
      carbs: Math.round(data.carbs || 0),
      fat: Math.round(data.fat || 0),
    });
  } catch (e) {
    console.warn('[widget] update failed:', e);
  }
}
