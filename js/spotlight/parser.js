// Lightweight intelligent parsing for Spotlight quick capture
// Detects type, date, time, and keywords from user input

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const KEYWORDS_TASK = ['task', 'todo', 'do', 'homework', 'project', 'work', 'submit', 'finish', 'complete'];
const KEYWORDS_EVENT = ['meeting', 'call', 'appointment', 'dinner', 'lunch', 'concert', 'show', 'party', 'conference', 'webinar', 'presentation', 'interview', 'workshop', 'class', 'tuition', 'lecture', 'event', 'session', 'gathering'];
const KEYWORDS_EXAM = ['exam', 'test', 'viva', 'quiz', 'practical', 'lab', 'assignment'];
const KEYWORDS_REMINDER = ['remind', 'remember', 'don\'t forget', 'buy', 'call', 'get', 'pick up', 'return'];

export function parseSpotlightInput(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { error: 'Empty input' };
  }

  const text = rawText.trim().toLowerCase();
  if (text.length === 0) return { error: 'Empty input' };

  // Extract time expressions (e.g., "5pm", "8:30am", "3:15 pm")
  const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  let time = null;
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    time = { hour, minute, period };
  }

  // Extract date indicators
  let dueDate = null;
  let dateIndicator = null;

  if (text.includes('tomorrow')) {
    dueDate = getDateISO(1);
    dateIndicator = 'tomorrow';
  } else if (text.includes('today')) {
    dueDate = getDateISO(0);
    dateIndicator = 'today';
  } else {
    // Check for weekday references
    for (const day of WEEKDAYS) {
      if (text.includes(day)) {
        const daysAhead = getDaysUntilWeekday(day);
        if (daysAhead !== null) {
          dueDate = getDateISO(daysAhead);
          dateIndicator = day;
        }
        break;
      }
    }
  }

  // Infer type based on keywords
  let type = 'task'; // default
  if (KEYWORDS_EVENT.some(kw => text.includes(kw))) {
    type = 'event';
  } else if (KEYWORDS_EXAM.some(kw => text.includes(kw))) {
    type = 'exam';
  } else if (KEYWORDS_REMINDER.some(kw => text.includes(kw))) {
    // Only classify as reminder if NO specific time is set
    // If there's a time, it's a scheduled task, not just a reminder
    type = time ? 'task' : 'reminder';
  }

  // Extract title (remove date/time keywords for cleaner display)
  let title = text;
  WEEKDAYS.forEach(day => {
    title = title.replace(day, '');
  });
  // Remove full time match first (includes am/pm), then other keywords
  if (timeMatch) {
    title = title.replace(timeMatch[0], '');
  }
  title = title.replace(/tomorrow|today/gi, '');
  title = title.replace(/\s+/g, ' ').trim();

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return {
    title,
    type,
    dueDate,
    dateIndicator,
    time,
    confidence: calculateConfidence(type, dueDate, time),
    raw: rawText
  };
}

function getDateISO(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysUntilWeekday(dayName) {
  const dayIndex = WEEKDAYS.indexOf(dayName.toLowerCase());
  if (dayIndex === -1) return null;

  const today = new Date();
  const todayIndex = today.getDay(); // 0 = Sunday
  const adjustedDayIndex = dayIndex === 0 ? 0 : dayIndex + 1; // Convert to JS day index
  let daysAhead = adjustedDayIndex - todayIndex;

  if (daysAhead <= 0) {
    daysAhead += 7;
  }
  return daysAhead;
}

function calculateConfidence(type, hasDate, hasTime) {
  let score = 0.5; // base
  if (hasDate) score += 0.3;
  if (hasTime) score += 0.2;
  return Math.min(1, score);
}

export function formatParsedForDisplay(parsed) {
  if (parsed.error) return null;

  let display = parsed.title;
  if (parsed.dateIndicator) {
    display += ` — ${parsed.dateIndicator}`;
  }
  if (parsed.time) {
    const ampm = parsed.time.period ? ` ${parsed.time.period}` : '';
    const min = parsed.time.minute > 0 ? `:${String(parsed.time.minute).padStart(2, '0')}` : '';
    display += ` @ ${parsed.time.hour}${min}${ampm}`;
  }
  return display;
}
