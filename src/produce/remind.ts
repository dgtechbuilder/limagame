/* The daily sell reminder (Dean, 2026-11-28): bring the player back each day to sell what is about to drop a grade.
   In the game it is the morning's news (src/systems/track.ts). With the reminder on and notifications allowed, the
   phone also gets one notification a day, from the first time the game is open (or left open in the background)
   after 7 in the morning: what drops a grade tonight, or what the stall can sell today. Tapping it opens the stall.

   A notification with the game fully closed needs a push server (Web Push with a VAPID key), which the game does not
   have yet: this is the part that works without one. Kept on the phone: localStorage `lima-sell-remind` (the last
   day one was shown). */

import { useEffect, useRef } from 'react';
import type { GameState } from '../state';
import { lifeOf } from '../livestock/model';
import { dropWords, storeCtx } from '../systems/track';
import { atRisk, leftToday, produceOf, storeKg } from './model';
import { money } from '../money';

const KEY = 'lima-sell-remind';
/** The hour (local time) from which the day's reminder can show. */
export const REMIND_HOUR = 7;
/** The link a reminder opens: the stall's Sell tab, marked so analytics can count the opens. */
export const REMIND_URL = './?from=sell-reminder#/market/sell';

export type RemindEvent = { name: 'shown'; kind: 'drop' | 'sell'; kg: number } | { name: 'opened' } | { name: 'permission'; result: NotificationPermission | 'unsupported' };
/** Who hears the reminder's moments (useAnalytics). */
export const remindListeners: ((e: RemindEvent) => void)[] = [];
const emit = (e: RemindEvent) => remindListeners.forEach(l => l(e));

const supported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyPermission = (): NotificationPermission | 'unsupported' => (supported() ? Notification.permission : 'unsupported');

/** Ask the browser for notifications (once: a refusal is the player's answer). */
export async function askNotify(): Promise<NotificationPermission | 'unsupported'> {
  if (!supported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    const r = await Notification.requestPermission();
    emit({ name: 'permission', result: r });
    return r;
  } catch {
    return 'denied';
  }
}

const todayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const lastShown = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const markShown = (day: string) => {
  try {
    window.localStorage.setItem(KEY, day);
  } catch {
    /* private mode: it may show again on the next visit */
  }
};

/** Today's reminder words, or null when there is nothing to sell. */
export function reminderFor(s: GameState): { title: string; body: string; kind: 'drop' | 'sell'; kg: number } | null {
  const p = produceOf(s.produce);
  if (!p.remind || storeKg(p) <= 0.05) return null;
  const left = leftToday(p, lifeOf(s.life).day);
  const risk = atRisk(p, storeCtx(s));
  if (risk.length) {
    const loss = risk.reduce((n, d) => n + d.loss, 0);
    const kg = Math.round(risk.reduce((n, d) => n + d.kg, 0) * 10) / 10;
    return { title: 'Sell before prices drop', body: `Tonight ${dropWords(risk)}: ${money(loss)} less at the stall. Sell it today.`, kind: 'drop', kg };
  }
  if (left <= 0) return null;
  return { title: 'The market stall is open', body: `${left} kg to sell today, from ${Math.round(storeKg(p))} kg in your store.`, kind: 'sell', kg: left };
}

async function show(title: string, body: string) {
  const opts: NotificationOptions = { body, tag: 'lima-sell', icon: './icon-192.png', badge: './icon-192.png', data: { url: REMIND_URL } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return void (await reg.showNotification(title, opts));
  } catch {
    /* fall back to a page notification */
  }
  const n = new Notification(title, opts);
  n.onclick = () => {
    window.focus();
    window.location.hash = '#/market/sell';
    emit({ name: 'opened' });
    n.close();
  };
}

/** Once a day, with the reminder on and notifications allowed: a notification with what to sell. */
export function useSellReminder(s: GameState) {
  const live = useRef(s);
  live.current = s;
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'sell-reminder') emit({ name: 'opened' });
    const check = () => {
      if (notifyPermission() !== 'granted') return;
      const now = new Date();
      if (now.getHours() < REMIND_HOUR) return;
      const day = todayKey(now);
      if (lastShown() === day) return;
      const r = reminderFor(live.current);
      if (!r) return;
      markShown(day);
      void show(r.title, r.body);
      emit({ name: 'shown', kind: r.kind, kg: r.kg });
    };
    check();
    const t = window.setInterval(check, 10 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
}
