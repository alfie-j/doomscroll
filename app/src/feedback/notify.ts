// Curiosity-hook notifications: one daily nudge at your usual time with an unseen hook,
// plus a streak-at-risk reminder tonight if the goal isn't done. Never "come back!".
import * as Notifications from 'expo-notifications';
import type { Engine } from '../engine/engine';

let asked = false;

export async function scheduleNudges(engine: Engine) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (!asked) {
      asked = true;
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) {
        const req = await Notifications.requestPermissionsAsync();
        if (!req.granted) return;
      }
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const hours = engine.s.openHours;
    let hour = 19;
    if (hours.some(h => h > 0)) hour = hours.indexOf(Math.max(...hours));
    const teaser = engine.teaser();
    if (teaser) {
      await Notifications.scheduleNotificationAsync({
        content: { title: teaser.title, body: 'Swipe to find out.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 3 },
      });
    }
    const tonight = new Date(); tonight.setHours(21, 0, 0, 0);
    if (!engine.s.daily.completed && engine.effectiveStreak > 0 && tonight.getTime() > Date.now()) {
      const left = Math.max(1, engine.goal - engine.s.daily.done);
      await Notifications.scheduleNotificationAsync({
        content: { title: `${engine.effectiveStreak}-day streak ends at midnight`, body: `${left} card${left === 1 ? '' : 's'} to keep it.` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tonight },
      });
    }
  } catch {
    // notifications unavailable (simulator, denied): the app works without them
  }
}
