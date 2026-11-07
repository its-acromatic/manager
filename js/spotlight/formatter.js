import { formatDate, formatTime } from './datetime.js';

export function formatParsedForDisplay(parsed) {
  if (!parsed || parsed.error) return null;
  return parsed.title;
}

export function getParsedMetadata(parsed) {
  const chips = [];
  if (parsed.dueDate) chips.push(formatDate(parsed.dueDate));
  if (parsed.time && !parsed.time.ambiguous) chips.push(formatTime(parsed.time));
  if (parsed.type) chips.push(parsed.type);
  if (parsed.priority) chips.push(parsed.priority);
  parsed.tags?.forEach((tag) => chips.push(`#${tag}`));
  return chips;
}