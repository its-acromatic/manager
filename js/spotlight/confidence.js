export function scoreParse({ type, forcedType, title, date, time, ambiguousTime, vagueTime, tags = [], priorityExplicit }) {
  let score = 0.38;
  if (forcedType) score += 0.38;
  else if (type !== 'task') score += 0.2;
  if (title && title.trim().length >= 3) score += 0.16;
  if (date) score += 0.12;
  if (time) score += vagueTime ? 0.04 : 0.1;
  if (priorityExplicit || tags.length) score += 0.03;
  if (ambiguousTime) score -= 0.5;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export function getClarification(confidence, time) {
  if (time?.ambiguous) return 'Time is ambiguous; this will be saved without a time unless you add am/pm.';
  if (confidence < 0.6) return 'Some details were unclear; check the preview before saving.';
  return '';
}