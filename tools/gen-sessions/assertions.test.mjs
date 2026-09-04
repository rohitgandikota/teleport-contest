import assert from 'node:assert/strict';
import test from 'node:test';

import { recordingIntegrityErrors } from './assertions.mjs';

test('recording integrity accepts terminal-edge cursor positions', () => {
    const session = {
        segments: [{ steps: [
            { cursor: [0, 0, 1], screen: '' },
            { cursor: [79, 23, 1], screen: 'clean' },
        ] }],
    };
    assert.deepEqual(recordingIntegrityErrors(session), []);
});

test('recording integrity rejects corrupt cursors and leaked markers', () => {
    const session = {
        segments: [{ steps: [
            { cursor: [1528528493, 809065243, 1], screen: '' },
            { cursor: [4, 6, 1], screen: '\x1b]7777;KIND=input;SEQ=20;' },
        ] }],
    };
    assert.deepEqual(recordingIntegrityErrors(session), [
        'segment 0 step 0 has invalid cursor [1528528493,809065243,1]',
        'segment 0 step 1 contains a leaked recorder marker',
    ]);
});
