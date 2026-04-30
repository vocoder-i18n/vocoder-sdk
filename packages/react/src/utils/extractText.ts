import React from "react";

export function extractText(children: React.ReactNode): string {
	return _extractText(children, { count: 0 });
}

function _extractText(
	children: React.ReactNode,
	elementIndex: { count: number },
): string {
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);

	if (Array.isArray(children)) {
		return children
			.map((child: React.ReactNode) => _extractText(child, elementIndex))
			.join("");
	}

	if (React.isValidElement(children)) {
		const elementType = children.type;
		if (typeof elementType === "string") {
			// Intrinsic element — map to numeric component placeholder
			const idx = elementIndex.count++;
			const props = children.props as { children?: React.ReactNode };
			const inner = _extractText(props.children, elementIndex);
			return inner ? `<c${idx}>${inner}</c${idx}>` : `<c${idx}/>`;
		}
		// React component — extract inner text only (not a translatable placeholder)
		return _extractText(
			(children.props as { children?: React.ReactNode }).children,
			elementIndex,
		);
	}

	return "";
}
