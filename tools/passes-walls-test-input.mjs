import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {game} from '../js/gstate.js';
import {wiz_intrinsic} from '../js/wizcmds.js';
import {getRngLog} from '../js/rng.js';
import {ECMD_OK} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

// Read the actual menu and send ordinary keyboard events. Pending startup or
// feedback prompts are acknowledged before menu selection, not bypassed.
export async function grant(run, amount, name = 'pass thru walls', cancel = false) {
    const prior = run._display.onEmptyQueue;
    let reads = 0, selected = false, menuRow = '', pending = [];
    const rng = [...getRngLog()];
    try {
        run._display.onEmptyQueue = async () => {
            assert.ok(++reads < 100, 'bounded real wizard menu input');
            await setImmediate();
            if (pending.length)
                return pending.shift().charCodeAt(0);
            const lines = decodeScreen(run._display.terminal.serialize())
                .map(row => row.map(c => c.ch).join('').trimEnd());
            if (!selected) {
                menuRow = lines.find(line => /^ *[a-zA-Z] [-+] /.test(line)
                    && line.includes(name)) || '';
                if (menuRow) {
                    selected = true;
                    const letter = menuRow.match(/^ *([a-zA-Z])/)[1];
                    pending = Array.from(cancel ? '\x1b'
                        : `${amount ?? ''}${letter}\r`);
                    return pending.shift().charCodeAt(0);
                }
                if (lines.some(line => /\(\d+ of \d+\)/.test(line)))
                    return '>'.charCodeAt(0);
            }
            return 32;
        };
        assert.equal(await wiz_intrinsic(), ECMD_OK);
        assert.ok(selected, 'the requested property is selected in the real menu');
        assert.equal(pending.length, 0);
        assert.deepEqual(getRngLog(), rng, 'the producer adds no RNG calls');
        return {menuRow, message: game._toplines || ''};
    } finally {
        run._display.onEmptyQueue = prior;
    }
}
