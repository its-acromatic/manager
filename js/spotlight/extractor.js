const FORCED_TYPES = new Map([
  ['task', 'task'], ['todo', 'task'], ['tas', 'task'],
  ['event', 'event'],
  ['exam', 'exam'],
  ['reminder', 'reminder'], ['remind', 'reminder'],
  ['focus', 'focus'],
  ['note', 'note']
]);

const EVENT_TERMS = /\b(meeting|call|appointment|dinner|lunch|concert|show|party|conference|webinar|presentation|interview|workshop|class|tuition|lecture|event|session|gathering|function)\b/i;
const EXAM_TERMS = /\b(exam|test|viva|quiz|practical)\b/i;
const FILLER_TERMS = /\b(?:please|me|my|a|an|the|on|at|for|to|remind|remember|don't forget|do not forget)\b/gi;
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

export function extractIntent(input) {
  const text = input.trim().replace(/\s+/g, ' ');
  const firstWord = text.match(/^([a-z]+)/i)?.[1]?.toLowerCase();
  const forcedType = FORCED_TYPES.get(firstWord) || null;
  let type = forcedType;

  if (!type) {
    if (/\b(focus|deep work|focus session)\b/i.test(text)) type = 'focus';
    else if (EXAM_TERMS.test(text)) type = 'exam';
    else if (EVENT_TERMS.test(text)) type = 'event';
    else if (/^(remind|remember)\b/i.test(text)) type = 'reminder';
    else type = 'task';
  }

  const priorityMatch = text.match(/\b(urgent|high|medium|low)\b/i);
  const tags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1].toLowerCase());
  const reminderOffsetMatch = text.match(/\b(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\s+before\b/i);
  let reminderOffsetMinutes = null;
  if (reminderOffsetMatch) {
    const amount = Number(reminderOffsetMatch[1]);
    const unit = reminderOffsetMatch[2].toLowerCase();
    reminderOffsetMinutes = amount * (unit.startsWith('day') ? 1440 : unit.startsWith('hour') || unit.startsWith('hr') ? 60 : 1);
  }

  return {
    type,
    forcedType,
    priority: priorityMatch ? priorityMatch[1].toLowerCase() : 'medium',
    explicitPriority: !!priorityMatch,
    tags,
    reminderOffsetMinutes,
    modeToken: forcedType ? firstWord : null
  };
}

export function extractTitle(input, { modeToken, dateText, timeText, priority, reminderOffsetMinutes, tags = [], type } = {}) {
  let title = input;
  const removals = [modeToken, dateText, timeText];
  removals.filter(Boolean).forEach((value) => {
    title = title.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, 'i'), ' ');
  });
  if (priority) title = title.replace(new RegExp(`\\b${escapeRegExp(priority)}\\b`, 'i'), ' ');
  if (reminderOffsetMinutes !== null && reminderOffsetMinutes !== undefined) {
    title = title.replace(/\b\d+\s*(?:minutes?|mins?|hours?|hrs?|days?)\s+before\b/i, ' ');
  }
  title = title.replace(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu, ' ');
  title = title.replace(/\b(?:today|tomorrow|tomrrow|tonight|next|this|after|in)\b/gi, ' ');
  title = title.replace(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, ' ');
  title = title.replace(/\b(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\b/gi, ' ');
  title = title.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ');
  title = title.replace(FILLER_TERMS, ' ');
  title = title.replace(/\s+/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, '').trim();
  if (!title) {
    if (tags.length) return tags.join(' ');
    return ({ focus: 'Focus session', note: 'Note', reminder: 'Reminder', task: 'Task', event: 'Event', exam: 'Exam' })[type] || 'Untitled item';
  }
  return title
    .replace(/\bphy\b/gi, 'physics')
    .replace(/\bhw\b/gi, 'homework')
    .replace(/\b\p{L}[\p{L}\p{N}'-]*/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}