/**
 * Start each page at the top.
 *
 * A single-page app keeps the window's scroll position across a route change,
 * so opening an order from halfway down the orders list drops you halfway down
 * the order page. The browser does this for free on a real page load; a router
 * has to do it by hand.
 *
 * Three decisions worth stating, because the obvious version of this is
 * subtly annoying:
 *
 *   - Only on PUSH, never on POP. Going back to a listing should return you
 *     to the row you left, which is what the browser already restores. Scroll
 *     resetting on back is the thing that makes people stop using back.
 *   - Keyed on pathname, not on the whole location. Switching a filter tab or
 *     typing in the search box updates the query string, and yanking someone
 *     to the top mid-typing is worse than leaving them where they are.
 *   - Instant, not smooth. Smooth-scrolling a fresh page animates through
 *     content the visitor never asked to see, and it races the route
 *     transition. It also respects prefers-reduced-motion by construction.
 *
 * An in-page #anchor still wins — that is an explicit request for a position.
 */
import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function ScrollReset() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;

    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
