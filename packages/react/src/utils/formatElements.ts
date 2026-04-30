import React from "react";

// Matches <c0>content</c0> (paired) or <c0/> (self-closing)
// Backreference \1 ensures closing tag matches opening index.
const TAG_RE = /<c(\d+)>([\s\S]*?)<\/c\1>|<c(\d+)\/>/g;

export function formatElements(
	message: string,
	components: React.ReactElement[],
): React.ReactNode[] {
	const result: React.ReactNode[] = [];
	const re = new RegExp(TAG_RE.source, "g");
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = re.exec(message)) !== null) {
		// Text before this tag
		if (match.index > lastIndex) {
			result.push(message.slice(lastIndex, match.index));
		}

		const pairedIndex = match[1];
		const innerContent = match[2];
		const selfClosingIndex = match[3];
		const idx = parseInt((pairedIndex ?? selfClosingIndex)!, 10);
		const component = components[idx];

		if (!component) {
			// Unknown index — render literally
			result.push(match[0]);
		} else if (selfClosingIndex !== undefined) {
			result.push(React.cloneElement(component, { key: `c${idx}` }));
		} else {
			// Recursively process inner content for nested components
			const inner = innerContent ? formatElements(innerContent, components) : [];
			result.push(React.cloneElement(component, { key: `c${idx}` }, ...inner));
		}

		lastIndex = match.index + match[0].length;
	}

	// Remaining text after last tag
	if (lastIndex < message.length) {
		result.push(message.slice(lastIndex));
	}

	return result;
}
