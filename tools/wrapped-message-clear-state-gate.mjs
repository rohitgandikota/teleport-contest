// Canonical C input validation completes before any game module loads.
import './wrapped-message-clear-preflight.mjs';
await import('./wrapped-message-clear/state.mjs');
