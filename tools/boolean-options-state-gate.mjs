#!/usr/bin/env node
// C options.c optfn_boolean() restricts when boolean settings may change.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseoptions, parseNethackrc } from '../js/options.js';

for (const name of ['debug_hunger', 'debug_mongen', 'debug_overwrite_stairs']) {
    test(`${name} cannot be set or cleared at startup`, () => {
        const result = { opts: { [name]: false } };
        assert.equal(parseoptions(name, true, true, result), false);
        assert.equal(result.opts[name], false);
        result.opts[name] = true;
        assert.equal(parseoptions('!' + name, true, false, result), false);
        assert.equal(result.opts[name], true);
        assert.equal(result.optSetInConfig, undefined);
    });

    test(`${name} can be set or cleared during play`, () => {
        const result = { opts: {} };
        assert.equal(parseoptions(name, false, false, result), true);
        assert.equal(result.opts[name], true);
        assert.equal(parseoptions('!' + name, false, false, result), true);
        assert.equal(result.opts[name], false);
    });
}

test('config-only booleans cannot be changed during play', () => {
    const result = { opts: { bones: true } };
    assert.equal(parseoptions('!bones', false, false, result), false);
    assert.equal(result.opts.bones, true);
    assert.equal(parseoptions('!bones', true, true, result), true);
    assert.equal(result.opts.bones, false);
});

test('a rejected option does not discard its neighboring settings', () => {
    const result = { opts: {} };
    assert.equal(parseoptions('time,debug_mongen,!autopickup', true, true,
        result), false);
    assert.deepEqual(result.opts, { time: true, autopickup: false });
    assert.deepEqual(result.optSetInConfig, { time: true, autopickup: true });
});

test('unavailable boolean storage is silently ignored', () => {
    const result = parseNethackrc('OPTIONS=BIOS,rawio\n');
    assert.deepEqual(result.opts, {});
    assert.deepEqual(result.errors, []);
});

test('rejected startup debug settings produce no error message', () => {
    const result = parseNethackrc('OPTIONS=debug_mongen,debug_hunger\n');
    assert.deepEqual(result.opts, {});
    assert.deepEqual(result.errors, []);
});
