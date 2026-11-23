#!/usr/bin/env node
// Source-derived checks for options.c parsebindings and cmd.c bind_key.
// The native recipe separately checks visible dispatch and repeat behavior.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { game, resetGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { parseNethackrc } from '../js/options.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/binding-command-precedence.json', import.meta.url)));

for (const [segment, key, command, param] of [
    [0, '~', 'versionshort'],
    [1, '~', 'versionshort'],
    [2, '~', 'versionshort'],
    [3, ',', 'versionshort'],
    [4, ',', 'versionshort'],
    [5, 'V', null],
    [6, '~', 'versionshort'],
    [7, '~', 'toggle', 'autopickup'],
]) {
    test(recipe.branches[segment], async () => {
        await runSegment({ ...recipe.segments[segment], moves: ' ',
            storage: new InMemoryStorage() });
        assert.equal(game.rc_key_bindings[key], command);
        assert.equal(game.rc_key_params?.[key], param);
    });
}

function parse(lines) {
    resetGame();
    return parseNethackrc(lines.map(line => 'BIND=' + line).join('\n'));
}

test('invalid commands leave the existing binding in place', () => {
    const rc = parse(['~:inventory', '~:bogus']);
    assert.deepEqual(rc.errors, ["Unknown key binding command 'bogus'"]);
    assert.equal(game.rc_key_bindings['~'], 'inventory');
});

test('internal commands cannot be bound', () => {
    const rc = parse(['~:inventory', '~:clicklook', '~:altadjust']);
    assert.deepEqual(rc.errors, ["Unknown key binding command 'clicklook'",
        "Unknown key binding command 'altadjust'"]);
    assert.equal(game.rc_key_bindings['~'], 'inventory');
});

test('bad keys do not discard the following bindings', () => {
    const rc = parse(['bad:inventory,~:versionshort']);
    assert.deepEqual(rc.errors, ["Unknown key binding key 'bad'"]);
    assert.equal(game.rc_key_bindings['~'], 'versionshort');
});

test('a quoted comma is one invalid key, not a list separator', () => {
    const rc = parse(["',':versionshort,~:inventory"]);
    assert.deepEqual(rc.errors, ["Unknown key binding key '',''"]);
    assert.equal(game.rc_key_bindings['~'], 'inventory');
});

test('replacing a parameter command clears its old parameter', () => {
    const rc = parse(['~:toggle(autopickup)', '~:toggle']);
    assert.deepEqual(rc.errors, ["'toggle' requires a parameter"]);
    assert.equal(game.rc_key_bindings['~'], 'toggle');
    assert.equal(game.rc_key_params['~'], undefined);
});

test('empty and forbidden parameters report errors after installing the binding', () => {
    const rc = parse(['~:toggle()', '!:versionshort(unwanted)']);
    assert.deepEqual(rc.errors, ['Required parameter cannot be empty',
        "'versionshort' does not take a parameter"]);
    assert.equal(game.rc_key_bindings['~'], 'toggle');
    assert.equal(game.rc_key_bindings['!'], 'versionshort');
    assert.deepEqual(game.rc_key_params, {});
});

test('empty parentheses are allowed on a command without parameters', () => {
    const rc = parse(['~:versionshort()']);
    assert.deepEqual(rc.errors, []);
    assert.equal(game.rc_key_bindings['~'], 'versionshort');
    assert.deepEqual(game.rc_key_params, {});
});

test('parameters stop at thirty UTF-8 bytes, including a partial character', () => {
    const rc = parse(['~:toggle(' + 'x'.repeat(29) + 'é)']);
    assert.deepEqual(rc.errors, []);
    assert.equal(game.rc_key_params['~'], 'x'.repeat(29) + '\xc3');
});

test('unbinding also discards a previous parameter', () => {
    const rc = parse(['~:toggle(autopickup)', '~:NOTHING']);
    assert.deepEqual(rc.errors, []);
    assert.equal(game.rc_key_bindings['~'], null);
    assert.equal(game.rc_key_params['~'], undefined);
});

test('a new game has no previous command parameters', async () => {
    await runSegment({ ...recipe.segments[7], moves: ' ',
        storage: new InMemoryStorage() });
    await runSegment({ ...recipe.segments[0], moves: ' ',
        storage: new InMemoryStorage() });
    assert.deepEqual(game.rc_key_params, {});
});
