/** Index of the slide closest to the scroll offset, clamped to the slides that exist. */
export function activeSlideIndex(scrollLeft: number, slideWidth: number, count: number): number {
  if (slideWidth <= 0 || count <= 0) return 0;
  const index = Math.round(scrollLeft / slideWidth);
  return Math.min(Math.max(index, 0), count - 1);
}

/** Next slide for a tab-bar key press (WAI-ARIA tabs pattern), or null for keys it does not handle. */
export function stepSlideIndex(current: number, key: string, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
