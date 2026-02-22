import { format, isToday, isTomorrow, parseISO } from 'date-fns';

export function formatDueDate(dueAt?: string): string {
  if (!dueAt) {
    return 'No deadline';
  }

  const due = parseISO(dueAt);

  if (isToday(due)) {
    return `Today · ${format(due, 'p')}`;
  }

  if (isTomorrow(due)) {
    return `Tomorrow · ${format(due, 'p')}`;
  }

  return format(due, 'EEE, MMM d · p');
}

export function shortNumber(value: number): string {
  if (value < 1000) {
    return String(value);
  }

  const units = ['K', 'M', 'B'];
  let amount = value;
  let unit = '';

  for (const candidate of units) {
    amount /= 1000;
    unit = candidate;
    if (amount < 1000) {
      break;
    }
  }

  return `${amount.toFixed(amount >= 10 ? 0 : 1)}${unit}`;
}
