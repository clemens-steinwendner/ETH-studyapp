import katex from "katex";

export function renderLatex(formula: string, displayMode = false): string {
  try {
    return katex.renderToString(formula, { displayMode, throwOnError: false });
  } catch {
    return formula;
  }
}
