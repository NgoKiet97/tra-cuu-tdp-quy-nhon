/** GA4 event helper. Never send full query, house numbers or contact details. */
export function trackEvent(name, parameters = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, parameters);
  }
}
export function trackSearch(mode, resultCount, ward = 'quy-nhon') {
  const category = ['exact', 'fallback', 'whole', 'reference', 'houseOnly'].includes(mode) ? mode : 'not_found';
  trackEvent('search_address', { ward, search_mode: category });
  trackEvent(category === 'exact' || category === 'fallback' || category === 'whole'
    ? 'search_result_found' : 'search_no_result', {
      ward, search_mode: category,
      // Only a coarse count; no address or exact search text.
      result_count_group: resultCount === 0 ? 'zero' : resultCount === 1 ? 'one' : 'multiple'
    });
}
