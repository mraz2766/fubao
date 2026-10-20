/**
 * Light haptic tick. Android uses the Vibration API; iOS Safari (18+) has no API,
 * but toggling a native `switch` checkbox from a user gesture plays the system haptic.
 */
let label: HTMLLabelElement | null = null;
export function haptic() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
      return;
    }
    if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return;
    if (!label) {
      label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
    }
    label.click();
  } catch {
    /* Haptics are a nicety only. */
  }
}
