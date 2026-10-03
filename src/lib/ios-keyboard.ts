/**
 * Raise the on-screen keyboard for a field that does not exist yet.
 *
 * iOS opens the keyboard only for focus given during a tap. A field that
 * mounts afterwards (an editor loaded on demand) gets focus too late, and the
 * keyboard stays down until the person taps it. Call this from the tap's
 * handler: it focuses a temporary invisible text field inside `container`,
 * which raises the keyboard, and removes it as soon as focus moves on — to the
 * real field, whose autofocus keeps the keyboard up — or after a second at
 * most. Harmless on platforms without the restriction.
 */
export function holdKeyboardForUpcomingField(container: HTMLElement): void {
  const proxy = document.createElement("input");
  proxy.type = "text";
  proxy.tabIndex = -1;
  proxy.setAttribute("aria-hidden", "true");
  // 16px so iOS doesn't zoom; invisible and out of the layout.
  proxy.style.cssText =
    "position:absolute;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;";
  container.append(proxy);
  proxy.focus({ preventScroll: true });

  const remove = (): void => {
    window.clearTimeout(timer);
    proxy.removeEventListener("blur", remove);
    proxy.remove();
  };
  const timer = window.setTimeout(remove, 1000);
  proxy.addEventListener("blur", remove);
}
