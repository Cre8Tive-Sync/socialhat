/**
 * A GA4 event, when analytics is on the page — which is only on the real
 * domain (see the tag in index.html). Everywhere else this does nothing, so
 * callers never have to ask.
 */
export function track(name, params) {
  window.gtag?.('event', name, params)
}
