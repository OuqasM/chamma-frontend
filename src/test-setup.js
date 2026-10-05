/**
 * Vitest setup, loaded for every suite.
 *
 * jsdom does implement `localStorage`, but vitest 2.1 does not forward it onto
 * the window a test sees — reading `window.localStorage` there throws a
 * TypeError. Since the app's context calls `localStorage.getItem` and
 * `.setItem` unguarded by name, every suite that renders `AppProvider` dies in
 * `beforeEach` before reaching an assertion.
 *
 * So this installs an in-memory Storage. It is a test double for a browser API,
 * not an app dependency: nothing here is imported by the storefront, and the
 * app never learns it is running against this rather than the real thing.
 *
 * Guarded on `window` because two suites run in the default `node` environment,
 * where there is no DOM to attach to.
 */
if (typeof window !== 'undefined') {
  const usable = (() => {
    try {
      // Touching the getter is the only reliable probe: vitest's window is a
      // proxy whose accessor throws rather than returning undefined, so
      // `typeof window.localStorage` never gets the chance to.
      window.localStorage.length
      return true
    } catch {
      return false
    }
  })()

  if (!usable) {
    const makeStorage = () => {
      const map = new Map()

      return {
        get length() {
          return map.size
        },
        key: (i) => [...map.keys()][i] ?? null,
        getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
        setItem: (k, v) => {
          map.set(String(k), String(v))
        },
        removeItem: (k) => {
          map.delete(String(k))
        },
        clear: () => map.clear(),
      }
    }

    const storage = makeStorage()
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  }

  // jsdom ships no `matchMedia`, and the header asks it whether the viewport is
  // wide so it can close the mobile menu when the layout takes over. Without
  // this, any suite that mounts the real header dies in an effect before it can
  // assert anything — so the absence is stubbed rather than worked around in
  // each test that trips over it.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      // Nothing matches: jsdom has no viewport, so every media query is equally
      // unanswerable. Tests that care which side of a breakpoint they are on
      // should set this themselves rather than inherit an answer from here.
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })
  }

  // jsdom has no layout, so it has no `scrollIntoView` either. Every browser
  // does, and the city combobox calls it to keep the active option in view when
  // the list opens — so any test that opens the combobox dies on it. A no-op is
  // honest here: with no layout there is nothing to scroll, and the assertion
  // being made is never about the scroll position.
  if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {}
  }
}
