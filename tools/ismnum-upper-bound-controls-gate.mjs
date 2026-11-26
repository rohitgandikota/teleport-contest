// Preflight completes before the original assertions import any game code.
import './ismnum-upper-bound-preflight.mjs';
await import('./ismnum-upper-bound-controls.mjs');
