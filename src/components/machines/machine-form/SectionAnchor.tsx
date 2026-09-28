import type React from "react";

/**
 * The fragment target at the start of a form section (machine-editing 5.1).
 *
 * Zero-height and separate from the section itself on purpose. The section
 * navigation marks "the last section whose START has scrolled past the
 * reading line", and a zero-height element crosses that line at one instant —
 * where a tall section straddles it for as long as it is on screen, which
 * `IntersectionObserver` cannot turn into a clean crossing.
 *
 * Absolutely positioned with no offsets, so it sits at its static position —
 * the top of whatever it is placed in — while taking no space, and so without
 * picking up the `space-y-*` margin of the stack around it. It needs a
 * positioned ancestor inside the scroll container (`SectionNavLayout`
 * provides one) so that it scrolls with the page.
 *
 * `scroll-mt-3` clears the phone's pinned "Jump to" control; the scroll
 * container's own `scroll-pt-14` supplies the rest.
 */
export function SectionAnchor({ id }: { id: string }): React.JSX.Element {
  return (
    <div id={id} data-section-anchor="" className="absolute scroll-mt-3" />
  );
}
