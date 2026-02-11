import React from 'react';

/**
 * Extracts plain text from React children, preserving variable placeholders and component tags.
 *
 * @example
 * extractText("Hello world") // "Hello world"
 * extractText(<>Hello {name}</>) // "Hello {name}" (preserves placeholder)
 * extractText(<>Click <link>here</link></>) // "Click <link>here</link>" (preserves component tags)
 */
export function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map((child: React.ReactNode) => extractText(child)).join('');
  }

  if (React.isValidElement(children)) {
    // Check if this is a component placeholder (lowercase intrinsic element used as placeholder)
    const elementType = children.type;
    if (typeof elementType === 'string') {
      // This is an intrinsic element like <link>, <bold>, etc.
      // Reconstruct the tag: <tagName>content</tagName>
      const tagName = elementType;
      const content = extractText(children.props.children);
      return `<${tagName}>${content}</${tagName}>`;
    }

    // For other React elements, extract text from children
    return extractText(children.props.children);
  }

  // For null, undefined, boolean, etc.
  return '';
}
