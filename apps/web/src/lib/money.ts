/** Euros to whole cents, matching the server's conversion exactly. */
export function toCents(euros: number): number {
  if (!Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}
