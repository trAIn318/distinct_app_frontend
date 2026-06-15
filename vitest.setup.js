import "@testing-library/jest-dom/vitest";

// IntersectionObserver no existe en jsdom — stub que dispara "visible" al observar.
class IO {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IO;

// matchMedia: por defecto reduced-motion = false.
globalThis.matchMedia = globalThis.matchMedia || ((q) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {},
}));

// requestAnimationFrame determinista para tests de conteo.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
