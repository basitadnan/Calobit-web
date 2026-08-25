// Daily local notifications (meal + weigh-in reminders) via Capacitor.
// Reminders are stored in the user's settings and (re)scheduled on change;
// they fire while the app is closed, which is the whole point.
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const REMINDER_IDS = { MEAL: 100, MEAL2: 102, WEIGH: 101 };

export async function notificationsSupported() {
  return Capacitor.isNativePlatform();
}

export async function ensurePermission() {
  if (!(await notificationsSupported())) return false;
  const res = await LocalNotifications.requestPermissions();
  return res.display === 'granted';
}

/**
 * (Re)schedules a daily notification at `timeStr` ("HH:MM", 24h).
 * Matching only hour+minute with repeating:true fires every day at that time.
 */
export async function scheduleDailyReminder(id, title, body, timeStr) {
  if (!(await notificationsSupported())) return false;
  if (!(await ensurePermission())) return false;

  const [hour, minute] = timeStr.split(':').map(Number);
  await LocalNotifications.cancel({ notifications: [{ id }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { on: { hour, minute }, repeating: true, allowWhileIdle: true },
      },
    ],
  });
  return true;
}

export async function cancelDailyReminder(id) {
  if (!(await notificationsSupported())) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}
