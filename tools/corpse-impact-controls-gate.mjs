// Preflight finishes before the original assertion module imports any game code.
import './corpse-impact-preflight.mjs';
await import('./corpse-impact-controls.mjs');
