/**
 * useStagger — compute per-item delays so a list of elements reveals in sequence
 * rather than all at once. Staggering is what leads the viewer's eye; it's the
 * single biggest upgrade over "fade everything in together."
 *
 * Example:
 *   const delayFor = useStagger({ base: 8, step: 5 });
 *   items.map((item, i) => <Thing key={i} delay={delayFor(i)} />)
 */
export function useStagger(opts?: { base?: number; step?: number }) {
  const base = opts?.base ?? 0;
  const step = opts?.step ?? 5;
  return (index: number) => base + index * step;
}
