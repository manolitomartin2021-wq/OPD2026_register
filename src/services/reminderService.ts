import { getDatabase } from '../data/db';
import { getISOWeekString, getTodayDateString, formatDateTimeKuching } from '../utils/dateUtils';
import { getCurrentSession } from '../data/dataService';

export interface FridayReminderState {
  isActive: boolean;
  isOverdue: boolean;
  isoWeek: string;
  message: string;
}

let snoozeUntilTimestamp: number | null = null;

export async function checkFridayReminder(): Promise<FridayReminderState> {
  const db = getDatabase();
  const currentWeek = getISOWeekString();

  // Check if already completed for this ISO week
  const statusSetting = await db.system_settings.get('peringatan_status_minggu_iso');
  if (statusSetting && statusSetting.value === currentWeek) {
    return { isActive: false, isOverdue: false, isoWeek: currentWeek, message: '' };
  }

  // Check if currently snoozed
  if (snoozeUntilTimestamp && Date.now() < snoozeUntilTimestamp) {
    return { isActive: false, isOverdue: false, isoWeek: currentWeek, message: '' };
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat, 1 = Mon...
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Is today Friday (5) at or past 16:00?
  const isFridayAtOrAfter4PM = dayOfWeek === 5 && (hours > 16 || (hours === 16 && minutes >= 0));

  // Is it past Friday of this current week (e.g. Saturday, Sunday) or Monday/Tuesday of next week and still undone?
  const isPastFriday = dayOfWeek === 6 || dayOfWeek === 0 || isFridayAtOrAfter4PM;

  // If it's earlier in the week (Mon-Thu or Fri before 16:00), check if the PREVIOUS week was never marked done
  if (!isPastFriday) {
    return { isActive: false, isOverdue: false, isoWeek: currentWeek, message: '' };
  }

  const isOverdue = dayOfWeek !== 5; // e.g. Saturday, Sunday, or Monday
  const message = isOverdue
    ? `PERINGATAN TERTUNGGAK: Sila salin data minggu (${currentWeek}) ke PC Penyelia dengan segera.`
    : `PERINGATAN: Sila salin data minggu ini (${currentWeek}) ke PC Penyelia.`;

  return {
    isActive: true,
    isOverdue,
    isoWeek: currentWeek,
    message,
  };
}

export function snoozeFridayReminder(minutes = 30) {
  snoozeUntilTimestamp = Date.now() + minutes * 60 * 1000;
}

export async function markReminderCompleted(reason = '') {
  const db = getDatabase();
  const currentWeek = getISOWeekString();
  const session = getCurrentSession();

  await db.system_settings.put({
    key: 'peringatan_status_minggu_iso',
    value: currentWeek,
    updated_at: formatDateTimeKuching(),
  });

  snoozeUntilTimestamp = null;
}
