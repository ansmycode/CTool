// Shared MV/MZ control-code cleaning rules. Plain brackets such as [Evd]
// are visible text unless introduced by an engine escape prefix.
export function stripTextControlCodes(text) {
  return text
    .replace(/\\[A-Za-z]+[\[\<\{\(][^\]\>\}\)]*[\]\>\}\)]/g, '')
    .replace(/\\[\.!><\{\}\^]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\[A-Za-z]+\[[^\]]*]/g, '')
    .trim();
}
