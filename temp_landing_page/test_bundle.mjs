import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, {
  url: 'http://localhost:5173/'
});

const skip = new Set(['navigator', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']);
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (skip.has(key)) continue;
  try {
    globalThis[key] = dom.window[key];
  } catch(e) {}
}
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia = () => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
});

try {
  console.log('Importing bundle...');
  await import('./dist/assets/index-C3JWveu5.js');
  console.log('Bundle imported successfully!');
  await new Promise(r => setTimeout(r, 1000));
  const root = dom.window.document.getElementById('root');
  console.log('Root HTML length:', root.innerHTML.length);
  if (root.innerHTML.length > 0) {
    console.log('SUCCESS! Root rendered:', root.innerHTML.slice(0, 200));
  } else {
    console.log('Root is EMPTY!');
  }
} catch (err) {
  console.error('CRASH DURING BUNDLE EXECUTION:', err);
}
