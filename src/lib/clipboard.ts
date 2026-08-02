/**
 * Copying text out of the app, with the fallbacks a PWA actually needs.
 *
 * `navigator.clipboard` is undefined outside a secure context and can reject on
 * a denied permission, and neither is rare on a phone opened over the LAN. The
 * legacy `execCommand` path is the only thing that still works there.
 *
 * Extracted from `ErrorFallback`, which had the only copy of it, so the review
 * screen does not become the second.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Denied, or an insecure context that exposes the API but refuses it.
  }

  const carrier = document.createElement("textarea")
  carrier.value = text
  carrier.setAttribute("readonly", "")
  carrier.style.position = "fixed"
  carrier.style.opacity = "0"
  document.body.appendChild(carrier)
  try {
    carrier.select()
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    // Even when select() or execCommand throw: a hidden node left in the DOM
    // would accumulate one per attempt.
    carrier.remove()
  }
}
