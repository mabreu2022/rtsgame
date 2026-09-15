export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function rotateTowards(current, target, step) {
  let diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}