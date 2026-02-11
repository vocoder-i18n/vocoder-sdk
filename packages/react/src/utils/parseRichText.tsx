import React from 'react';

/**
 * Parse translated text with component placeholders and render with actual components
 *
 * Handles patterns like: "Click <link>here</link> for help"
 * Replaces <link> with actual React component provided in components map
 *
 * @param text - Translated text with component placeholders
 * @param components - Map of component names to React elements
 * @returns Array of React nodes
 *
 * @example
 * ```tsx
 * parseRichText(
 *   "Click <link>here</link> for help",
 *   { link: <a href="/help" /> }
 * )
 * // Returns: ["Click ", <a href="/help">here</a>, " for help"]
 * ```
 */
export function parseRichText(
  text: string,
  components: Record<string, React.ReactElement>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /<(\w+)>(.*?)<\/\1>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, tagName, content] = match;
    const matchIndex = match.index;

    // Add text before the tag
    if (matchIndex > lastIndex) {
      const beforeText = text.substring(lastIndex, matchIndex);
      if (beforeText) {
        parts.push(beforeText);
      }
    }

    // Get the component from the map
    const component = components[tagName];

    if (component) {
      // Clone the component and add the content as children
      const clonedComponent = React.cloneElement(
        component,
        { key: `component-${keyCounter++}` },
        content
      );
      parts.push(clonedComponent);
    } else {
      // If component not provided, render as plain text with warning
      console.warn(`Component "${tagName}" not provided to <T> components prop`);
      parts.push(`<${tagName}>${content}</${tagName}>`);
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(remainingText);
    }
  }

  // If no matches found, return original text
  if (parts.length === 0) {
    return [text];
  }

  return parts;
}

/**
 * Check if text contains component placeholder tags
 */
export function hasComponentPlaceholders(text: string): boolean {
  return /<\w+>.*?<\/\w+>/.test(text);
}
