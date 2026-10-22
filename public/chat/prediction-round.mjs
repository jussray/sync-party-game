// Chat Edition local presentation identity. Never sent to shared game authority.
export function makePredictionKey(code, round, deadline) {
  const room = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(room) || !Number.isInteger(round) || round < 1 ||
      !Number.isSafeInteger(deadline) || deadline <= 0) return null;
  return `room:${room}:round:${round}:deadline:${deadline}`;
}

export function predictionHit(counts, selected) {
  if (!Array.isArray(counts) || !Number.isInteger(selected) || selected < 0 ||
      selected >= counts.length || counts.some(n => !Number.isSafeInteger(n) || n < 0)) return false;
  const best = Math.max(0, ...counts);
  return best > 0 && counts[selected] === best;
}
