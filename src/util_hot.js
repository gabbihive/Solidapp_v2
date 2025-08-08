export function hotScore(score, createdAt) {
  const s = Math.max(score, 1);
  return Math.log10(s) + (createdAt / 45000);
}