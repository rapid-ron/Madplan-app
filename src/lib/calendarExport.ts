import { MealPlan, MealTimes, MEAL_SLOT_LABELS, PlannedMeal } from '../types';

function formatIcsDateTime(dateIso: string, timeHHMM: string, addMinutes = 0): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 12, (mm || 0) + addMinutes, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildWeeklyPlanIcs(plan: MealPlan, mealTimes: MealTimes): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MadPlan Nord//Ugeplan//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:MadPlan Nord - ${escapeIcsText(plan.weekLabel)}`,
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

  for (const day of plan.days) {
    for (const meal of day.meals) {
      const startTime = mealTimes[meal.slot] || '18:00';
      const duration = Math.max(30, meal.prepMinutes + 20);
      const dtStart = formatIcsDateTime(day.dateIso, startTime);
      const dtEnd = formatIcsDateTime(day.dateIso, startTime, duration);
      const summary = `${MEAL_SLOT_LABELS[meal.slot]}: ${meal.title}`;
      const desc = `${meal.description}\n\nNæring: ${meal.calories} kcal | Protein ${meal.protein}g | Kulhydrat ${meal.carbs}g | Fedt ${meal.fat}g | Fibre ${meal.fiber}g\nTilberedning: ${meal.prepMinutes} min\nEstimeret pris: ${meal.estimatedCostDkk} kr.`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${plan.id}-${day.dayIndex}-${meal.slot}@madplannord.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(desc)}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Tid til at forberede ${escapeIcsText(meal.title)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadWeeklyPlanIcs(plan: MealPlan, mealTimes: MealTimes): void {
  const icsContent = buildWeeklyPlanIcs(plan, mealTimes);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `madplan-${plan.startDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(dateIso: string, meal: PlannedMeal, mealTimes: MealTimes): string {
  const startTime = mealTimes[meal.slot] || '18:00';
  const dtStart = formatIcsDateTime(dateIso, startTime);
  const dtEnd = formatIcsDateTime(dateIso, startTime, Math.max(30, meal.prepMinutes + 20));
  const title = `${MEAL_SLOT_LABELS[meal.slot]}: ${meal.title}`;
  const details = `${meal.description}\n\nKalorier: ${meal.calories} kcal | Protein: ${meal.protein}g | Kulhydrat: ${meal.carbs}g | Fedt: ${meal.fat}g\nTilberedning: ${meal.prepMinutes} min`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${dtStart}/${dtEnd}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function requestAndSendNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
    });
    return true;
  }
  return false;
}
