/** Smallest device size the checkout flow must remain usable on (iPhone SE 2020 class, per design-brief.md). */
export const MIN_SUPPORTED_WIDTH = 750;
export const MIN_SUPPORTED_HEIGHT = 1334;

export interface ResponsiveLayout {
  columns: 1 | 2 | 3;
  horizontalPadding: number;
  contentWidth: number;
}

const MIN_HORIZONTAL_PADDING = 16;

/**
 * Pure layout calculation shared by every screen so the catalog grid and
 * content column widen predictably on larger screens while never clipping
 * or overflowing down to the documented 750x1334 boundary.
 */
export function getResponsiveLayout(width: number, _height: number): ResponsiveLayout {
  const safeWidth = Math.max(width, MIN_SUPPORTED_WIDTH);
  const columns: ResponsiveLayout["columns"] = safeWidth >= 1400 ? 3 : safeWidth >= 1000 ? 2 : 1;
  const horizontalPadding = Math.max(MIN_HORIZONTAL_PADDING, Math.round(safeWidth * 0.04));
  const contentWidth = safeWidth - horizontalPadding * 2;
  return { columns, horizontalPadding, contentWidth };
}
