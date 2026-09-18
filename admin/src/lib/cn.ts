/**
 * Class name joiner.
 *
 * Conditional classes go through this, never string interpolation — an
 * interpolated class cannot be grepped and Tailwind cannot see it to
 * generate the CSS.
 */
export const cn = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');
