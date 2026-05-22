export function calculateAttendance(attended, total) {
  if(!total || total === 0) return 0;
  return Number(((attended / total) * 100).toFixed(2));
}

export function calculateSafeLeaves(attended, total, required = 75) {
  // maximum additional absences allowed while staying >= required percent
  if(total === 0) return 0;
  const maxTotalAllowed = (attended * 100) / required;
  const leaves = Math.floor(maxTotalAllowed - total);
  return Math.max(0, leaves);
}

export function forecastIfAllPresent(attended, total, remainingWorkingDays) {
  const futurePresent = remainingWorkingDays;
  const newAttended = attended + futurePresent;
  const newTotal = total + remainingWorkingDays;
  if(newTotal === 0) return 0;
  return Number(((newAttended / newTotal) * 100).toFixed(2));
}
