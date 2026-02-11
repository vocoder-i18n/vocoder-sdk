/**
 * Interpolates variables into a translation string.
 *
 * @example
 * interpolate("Hello {name}!", { name: "John" }) // "Hello John!"
 * interpolate("You have {count} messages", { count: 5 }) // "You have 5 messages"
 *
 * @param text - The translation string with {variable} placeholders
 * @param values - Object containing variable values
 * @returns Interpolated string with values replaced
 */
export function interpolate(
  text: string,
  values: Record<string, any>
): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in values) {
      const value = values[key];
      return value !== null && value !== undefined ? String(value) : match;
    }
    // If variable not provided, leave placeholder as-is
    return match;
  });
}
