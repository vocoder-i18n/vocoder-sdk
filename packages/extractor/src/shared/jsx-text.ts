/**
 * JSX whitespace normalisation for raw `JSXText` AST nodes.
 *
 * The extractor reads text straight out of the AST, where it still carries the
 * source file's newlines and indentation. The runtime never sees that: the JSX
 * compiler rewrites text children before `<T>` is called, so `extractText`
 * receives an already-normalised string. Hashing the raw AST value therefore
 * produces a different key at build time than at runtime, and the translation
 * is never found.
 *
 * This reproduces the JSX text semantics every compiler implements:
 *
 *   - a line's leading whitespace is dropped unless it is the first line
 *   - a line's trailing whitespace is dropped unless it is the last line
 *   - lines that are empty after that are removed entirely
 *   - surviving lines are joined with a single space
 *   - tabs count as whitespace
 *
 * Note what is deliberately *not* done: runs of spaces inside a single line are
 * preserved. `<T>Two  spaces</T>` keeps both, so a blanket `\s+` collapse would
 * silently change the source text and break the very keys this exists to align.
 */
export function cleanJSXText(value: string): string {
	const lines = value.split(/\r\n|\n|\r/);

	let lastNonEmptyLine = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/[^ \t]/.test(lines[i] as string)) lastNonEmptyLine = i;
	}

	let out = "";
	for (let i = 0; i < lines.length; i++) {
		let line = (lines[i] as string).replace(/\t/g, " ");
		if (i !== 0) line = line.replace(/^ +/, "");
		if (i !== lines.length - 1) line = line.replace(/ +$/, "");
		if (!line) continue;
		if (i !== lastNonEmptyLine) line += " ";
		out += line;
	}
	return out;
}
