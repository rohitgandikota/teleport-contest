#!/usr/bin/env node
// Exercise the real recordSegment queue with an immediate child exit while
// RNG file reads are still pending. No native process or filesystem is changed.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// An optional source path checks an archived recorder revision.
const source = readFileSync(process.argv[2]
    || new URL('../scripts/record-session.mjs', import.meta.url), 'utf8');
const body = source.match(/^async function recordSegment\([^]*?^}$/m)?.[0];
assert.ok(body, 'recorder entry point');
const input = (seq, payload) => ({ kind: 'input', seq, cx: 0, cy: 0, payload });

async function record(moves, batches) {
    let child, batch = 0, rngText = '';
    function send() {
        const next = batches[batch++];
        if (!next)
            return;
        rngText = next.rng;
        for (const marker of next.markers)
            child.stdout.emit('data', marker);
        if (next.exit)
            child.emit('close', 0, null);
    }
    const spawn = () => {
        child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stdin = new EventEmitter();
        child.stdin.write = () => { setImmediate(send); return true; };
        child.stdin.end = () => { child.stdin.writableEnded = true; };
        child.kill = () => false;
        setImmediate(send);
        return child;
    };
    const fs = {
        mkdir: async () => {}, writeFile: async () => {},
        open: async () => {
            const data = Buffer.from(rngText);
            return {
                stat: async () => ({ size: data.length }),
                read: async (buf, offset, length, position) =>
                    data.copy(buf, offset, position, position + length),
                close: async () => {},
            };
        },
    };
    class MarkerParser {
        constructor(onMarker) { this.onMarker = onMarker; }
        push(marker) { if (!this.stopped) this.onMarker(marker); }
        stop() { this.stopped = true; }
    }
    const recordSegment = new Function('fs', 'path', 'spawn',
        'clearStaleState', 'clearAbandonedGame', 'parseNethackrcName',
        'MarkerParser', 'encodeScreenAnsiRle', 'payloadToLines', 'parseRngLines',
        'setTimeout', 'clearTimeout', 'return (' + body + ');')(
        fs, path, spawn, async () => {}, async () => {}, () => null,
        MarkerParser, lines => lines.join('\n'), text => [text],
        text => text.split('\n').filter(Boolean),
        () => ({ unref() {} }), () => {});
    return recordSegment({ seg: { moves }, isFirstSegment: true,
        binary: 'fake-recorder', installDir: 'fake-install', rngLogPath: 'fake-rng',
        homeDir: 'fake-home', tz: 'Etc/GMT+4' });
}

test('natural exit retains a final frame whose RNG read is still pending', async () => {
    const steps = await record('', [
        { markers: [input(1, 'Be seeing you...')], rng: 'final draw\n', exit: true },
    ]);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].screen, 'Be seeing you...');
    assert.deepEqual(steps[0].rng, ['final draw']);
});

for (const exit of [false, true]) {
    test(`${exit ? 'natural exit' : 'expected-step completion'} drains queued animation and input markers`, async () => {
        const steps = await record('x', [
            { markers: [input(1, 'start')], rng: 'first draw\n' },
            { markers: [{ ...input(2, 'animation'), kind: 'anim' }, input(2, 'end')],
                rng: 'first draw\nlast draw\n', exit },
        ]);
        assert.equal(steps.length, 2);
        assert.deepEqual(steps.map(step => step.key), [null, 'x']);
        assert.deepEqual(steps.map(step => step.rng), [['first draw'], ['last draw']]);
        assert.deepEqual(steps[1].animation_frames,
            [{ screen: 'animation', cursor: [0, 0, 1] }]);
    });
}

test('an early natural exit retains every received frame without inventing missing input', async () => {
    const steps = await record('xy', [
        { markers: [input(1, 'start')], rng: '' },
        { markers: [input(2, 'game over')], rng: '', exit: true },
    ]);
    assert.deepEqual(steps.map(step => step.key), [null, 'x']);
    assert.equal(steps[1].screen, 'game over');
});
