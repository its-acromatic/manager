import { extractDate, extractTime, toScheduledDateTime } from './datetime.js';
import { scoreParse, getClarification } from './confidence.js';
import { extractIntent, extractTitle } from './extractor.js';
import { formatParsedForDisplay, getParsedMetadata } from './formatter.js';

export function parseSpotlightInput(rawText, now = new Date()) {
  if (typeof rawText !== 'string' || !rawText.trim()) return { error: 'Type something to capture.' };

  const raw = rawText.trim().replace(/\s+/g, ' ');
  const normalized = raw.replace(/\btomrrow\b/gi, 'tomorrow');
  const intent = extractIntent(normalized);
  const dateResult = extractDate(normalized, now);
  const withoutDate = dateResult
    ? normalized.replace(new RegExp(escapeRegExp(dateResult.matchedText), 'i'), ' ')
    : normalized;
  const explicitTime = extractTime(withoutDate, !!dateResult);
  const timeResult = explicitTime || (dateResult?.indicator === 'tonight'
    ? { time: { hour: 21, minute: 0, period: null, vague: true, ambiguous: false }, matchedText: '', indicator: 'night' }
    : null);
  const hasNow = !!dateResult?.now;
  const dueDate = dateResult?.date || (timeResult ? localToday(now) : null);
  const time = timeResult && !timeResult.time.ambiguous ? timeResult.time : null;
  const scheduledDateTime = hasNow && !timeResult
    ? now.toISOString()
    : toScheduledDateTime(dueDate, time || (dueDate ? { hour: 0, minute: 0 } : null));
  const title = extractTitle(normalized, {
    modeToken: intent.modeToken,
    dateText: dateResult?.matchedText,
    timeText: timeResult?.matchedText,
    priority: intent.explicitPriority ? intent.priority : null,
    reminderOffsetMinutes: intent.reminderOffsetMinutes,
    tags: intent.tags,
    type: intent.type
  });

  let reminderAtDateTime = time || hasNow ? scheduledDateTime : null;
  if (time && scheduledDateTime && intent.reminderOffsetMinutes) {
    reminderAtDateTime = new Date(Date.parse(scheduledDateTime) - intent.reminderOffsetMinutes * 60000).toISOString();
  }

  const confidence = scoreParse({
    type: intent.type,
    forcedType: intent.forcedType,
    title,
    date: dateResult,
    time,
    ambiguousTime: !!timeResult?.time.ambiguous,
    vagueTime: !!timeResult?.time.vague,
    tags: intent.tags,
    priorityExplicit: intent.explicitPriority
  });

  return {
    title,
    type: intent.type,
    dueDate,
    dateIndicator: dateResult?.indicator || (timeResult ? 'today' : null),
    time,
    scheduledDateTime,
    scheduledHasTime: !!time || hasNow,
    reminderAtDateTime,
    reminderOffsetMinutes: intent.reminderOffsetMinutes,
    priority: intent.explicitPriority ? intent.priority : null,
    tags: intent.tags,
    subject: intent.type === 'exam' ? title.split(' ')[0] : null,
    launchNow: hasNow && intent.type === 'focus',
    confidence,
    clarification: getClarification(confidence, timeResult?.time),
    raw
  };
}

export { formatParsedForDisplay, getParsedMetadata };

function localToday(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}