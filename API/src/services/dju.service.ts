export function computeDJU(baseC: number, tmeanC: number): number {
  const dju = baseC - tmeanC;
  return dju > 0 ? dju : 0;
}
