/** Two semantic title groups; responsive wrapping within each group remains native. */
export function titleLines(title) {
  const words = String(title).trim().split(/\s+/);
  if (words.length < 2) return words;
  let split = 1,
    best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const difference = Math.abs(
      words.slice(0, i).join(' ').length - words.slice(i).join(' ').length,
    );
    if (difference < best) {
      split = i;
      best = difference;
    }
  }
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
}
