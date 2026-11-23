#!/usr/bin/env node
// options.c optfn_fruit() rejects empty input before calling fruit_from_name.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../js/jsmain.js';
import { resetGame } from '../js/gstate.js';
import { parseNethackrc, parseoptions } from '../js/options.js';

for (const option of ['fruit', 'fruit:', 'fruit=', 'fruit:   ']) {
    test(`${JSON.stringify(option)} leaves the configured fruit unchanged`, () => {
        resetGame();
        const rc = parseNethackrc('OPTIONS=fruit:pear\nOPTIONS=' + option + '\n');
        assert.equal(rc.opts.fruit, 'pear');
        assert.deepEqual(rc.errors, [`Missing parameter for '${option.trim()}'`]);
    });

    test(`${JSON.stringify(option)} is rejected silently during play`, () => {
        resetGame();
        const result = { opts: { fruit: 'pear' } };
        assert.equal(parseoptions(option, false, false, result), false);
        assert.equal(result.opts.fruit, 'pear');
    });
}
