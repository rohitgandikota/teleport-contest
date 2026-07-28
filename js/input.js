// input.js — Keystroke input handling.
// Provides async nhgetch() that reads from an input queue.

import { game } from './gstate.js';
import { KEY_BINDINGS } from './terminal.js';

const _inputQueue = [];

export function pushKey(key) {
    _inputQueue.push(typeof key === 'number' ? key : key.charCodeAt(0));
}

export function pushKeys(keys) {
    for (const k of keys) pushKey(k);
}

// C ref: tty_nhgetch — read one key.
// In replay mode, reads from the input queue.
// In browser mode, waits for a real keypress.
export async function nhgetch() {
    /* win/tty/wintty.c:4066 (tty_nhgetch) — reading a fresh key lifts the
       ESC message suppression. The order matters: more() sets WIN_STOP
       AFTER its dismissing read returns, so the flag survives exactly until
       the next read, and tty_yn_function tests it before its own read. */
    game._win_stop = false;
    // Fire the capture hook before reading the next key
    const hook = game._preNhgetchHook;
    if (hook) await hook();

    if (_inputQueue.length > 0) {
        return _inputQueue.shift();
    }

    // Browser mode: wait for keypress from the display
    const display = game?.nhDisplay;
    if (display?.readKey) {
        return await display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
    }

    throw new Error('Input queue empty - test may be missing keystrokes');
}

// Reset input state
export function resetInputState() {
    _inputQueue.length = 0;
}
