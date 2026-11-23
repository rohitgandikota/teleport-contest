#!/usr/bin/env node
// Exercise recorder child lifetime with fake processes, clocks and RNG reads.
// An optional source path checks an archived recorder revision.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const source = readFileSync(process.argv[2]
    || new URL('../scripts/record-session.mjs', import.meta.url), 'utf8');
const body = source.match(/^async function recordSegment\([^]*?^}$/m)?.[0];
assert.ok(body, 'recorder entry point');
const drain = () => new Promise(resolve => setImmediate(resolve));
const input = (seq = 1, payload = 'frame') => ({ kind: 'input', seq, cx: 0, cy: 0, payload });

function harness(t, { moves = '', spawnError = null, failedSpawn = false } = {}) {
    let now = 0, rngText = '', readGate = null, childClosed = false;
    const timers = new Set(), signals = [], writes = [], reads = [];
    const child = new EventEmitter();
    child.pid = failedSpawn ? undefined : 12345;
    child.stdout = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.write = bytes => { writes.push(bytes.toString('latin1')); return true; };
    child.stdin.end = () => { child.stdin.writableEnded = true; };
    child.kill = signal => { signals.push({ signal, at: now }); return !childClosed && !!child.pid; };
    const setTimer = (callback, ms) => {
        const timer = { callback, at: now + ms, unref() { return this; } };
        timers.add(timer);
        return timer;
    };
    const advance = ms => {
        const end = now + ms;
        for (;;) {
            const timer = [...timers].filter(timer => timer.at <= end)
                .sort((a, b) => a.at - b.at)[0];
            if (!timer) break;
            now = timer.at;
            timers.delete(timer);
            timer.callback();
        }
        now = end;
    };
    const fs = {
        mkdir: async () => {}, writeFile: async () => {},
        open: async () => {
            const bytes = Buffer.from(rngText);
            return {
                stat: async () => ({ size: bytes.length }),
                read: async (buffer, offset, length, position) => {
                    reads.push(position);
                    if (readGate) await readGate.promise;
                    bytes.copy(buffer, offset, position, position + length);
                },
                close: async () => {},
            };
        },
    };
    class MarkerParser {
        constructor(onMarker) { this.onMarker = onMarker; }
        push(marker) { if (!this.stopped) this.onMarker(marker); }
        stop() { this.stopped = true; }
    }
    const record = new Function('fs', 'path', 'spawn', 'clearStaleState',
        'clearAbandonedGame', 'parseNethackrcName', 'MarkerParser',
        'encodeScreenAnsiRle', 'payloadToLines', 'parseRngLines',
        'setTimeout', 'clearTimeout', 'return (' + body + ');')(
        fs, path, () => { if (spawnError) throw spawnError; return child; },
        async () => {}, async () => {}, () => null, MarkerParser,
        value => value, value => value, text => text.split('\n').filter(Boolean),
        setTimer, timer => timers.delete(timer));
    let outcome = { status: 'pending' };
    const done = record({ seg: { moves }, isFirstSegment: true,
        binary: 'fake', installDir: 'fake', rngLogPath: 'fake', homeDir: 'fake', tz: 'UTC' })
        .then(steps => (outcome = { status: 'fulfilled', steps }),
            error => (outcome = { status: 'rejected', error }));
    const close = (code = 0, signal = null) => {
        if (childClosed || spawnError) return;
        childClosed = true;
        child.emit('close', code, signal);
    };
    const releaseRead = () => { readGate?.resolve(); readGate = null; };
    t.after(async () => { releaseRead(); close(); await drain(); });
    return {
        child, signals, writes, reads, timers, done, close, advance, releaseRead,
        outcome: () => outcome,
        send: marker => child.stdout.emit('data', marker),
        rng: text => { rngText = text; },
        holdRead: () => {
            let resolve;
            const promise = new Promise(res => { resolve = res; });
            readGate = { promise, resolve };
        },
    };
}

test('final input cannot resolve the segment before delayed child close', async t => {
    const h = harness(t);
    await drain();
    h.send(input());
    await drain();
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 0 }]);
    assert.equal(h.outcome().status, 'pending', 'next segment must not start yet');
    h.advance(400);
    await drain();
    assert.equal(h.outcome().status, 'pending');
    h.close(null, 'SIGTERM');
    const result = await h.done;
    assert.equal(result.status, 'fulfilled');
    assert.equal(result.steps.length, 1);
    assert.equal(h.timers.size, 0);
});

test('first-marker timeout stops the child and waits for close before throwing', async t => {
    const h = harness(t);
    await drain();
    h.advance(20000);
    await drain();
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 20000 }]);
    assert.equal(h.outcome().status, 'pending');
    h.close(null, 'SIGTERM');
    const result = await h.done;
    assert.equal(result.status, 'rejected');
    assert.match(result.error.message, /recorder timeout: first marker/);
    assert.equal(h.timers.size, 0);
});

for (const [label, marker, error] of [
    ['invalid cursor', { ...input(), cx: 80 }, /invalid recorder cursor/],
    ['leaked marker', input(1, '\x1b]7777;bad'), /marker leaked into screen/],
]) {
    test(`${label} stops the child before returning the original rejection`, async t => {
        const h = harness(t);
        await drain();
        h.send(marker);
        await drain();
        assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 0 }]);
        assert.equal(h.outcome().status, 'pending');
        h.close(null, 'SIGTERM');
        const result = await h.done;
        assert.equal(result.status, 'rejected');
        assert.match(result.error.message, error);
        assert.equal(h.timers.size, 0);
    });
}

test('asynchronous spawn failure retains the error and waits for stdio close', async t => {
    const h = harness(t, { failedSpawn: true });
    const error = Object.assign(new Error('spawn fake ENOENT'), { code: 'ENOENT' });
    await drain();
    h.child.emit('error', error);
    await drain();
    assert.equal(h.outcome().status, 'pending');
    assert.deepEqual(h.signals, [], 'there is no process to signal');
    assert.equal(h.timers.size, 0);
    h.close(-2);
    assert.equal((await h.done).error, error);
});

test('synchronous spawn failure rejects without waiting for a nonexistent child', async t => {
    const error = new Error('invalid spawn arguments');
    const h = harness(t, { spawnError: error });
    assert.equal((await h.done).error, error);
    assert.deepEqual(h.signals, []);
    assert.equal(h.timers.size, 0);
});

test('SIGKILL follows an ignored SIGTERM once, and resolution still waits for close', async t => {
    const h = harness(t);
    await drain();
    h.send(input());
    await drain();
    h.advance(999);
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 0 }]);
    h.advance(1);
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 0 }, { signal: 'SIGKILL', at: 1000 }]);
    h.advance(5000);
    assert.equal(h.signals.length, 2, 'cleanup must not restart escalation');
    assert.equal(h.outcome().status, 'pending', 'a sent SIGKILL is not close');
    h.close(null, 'SIGKILL');
    assert.equal((await h.done).status, 'fulfilled');
    assert.equal(h.timers.size, 0);
});

test('child close cancels escalation instead of signalling the closed process later', async t => {
    const h = harness(t);
    await drain();
    h.send(input());
    await drain();
    h.advance(999);
    h.close(null, 'SIGTERM');
    await h.done;
    h.advance(1);
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 0 }]);
    assert.equal(h.timers.size, 0);
});

test('timeout cleanup also escalates and preserves its original error', async t => {
    const h = harness(t);
    await drain();
    h.advance(20000);
    await drain();
    h.advance(1000);
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 20000 }, { signal: 'SIGKILL', at: 21000 }]);
    assert.equal(h.outcome().status, 'pending');
    h.close(null, 'SIGKILL');
    const result = await h.done;
    assert.equal(result.status, 'rejected');
    assert.match(result.error.message, /recorder timeout: first marker/);
    assert.equal(h.timers.size, 0);
});

test('natural exit waits for a pending final RNG read without losing its frame', async t => {
    const h = harness(t);
    await drain();
    h.rng('final draw\n');
    h.holdRead();
    h.send(input(1, 'goodbye'));
    await drain();
    assert.equal(h.reads.length, 1);
    h.close();
    await drain();
    assert.equal(h.outcome().status, 'pending');
    assert.equal(h.timers.size, 0, 'closed child must not retain an input timeout');
    h.releaseRead();
    const result = await h.done;
    assert.deepEqual(result.steps, [{ key: null, rng: ['final draw'], screen: 'goodbye', cursor: [0, 0, 1] }]);
    assert.deepEqual(h.signals, []);
});

test('queued final animation and input remain paired when close precedes their RNG read', async t => {
    const h = harness(t, { moves: 'x' });
    await drain();
    h.rng('first draw\n');
    h.send(input(1, 'start'));
    await drain();
    h.rng('first draw\nlast draw\n');
    h.holdRead();
    h.send({ ...input(2, 'animation'), kind: 'anim' });
    h.send(input(2, 'end'));
    h.close();
    await drain();
    assert.equal(h.outcome().status, 'pending');
    h.releaseRead();
    const result = await h.done;
    assert.deepEqual(result.steps, [
        { key: null, rng: ['first draw'], screen: 'start', cursor: [0, 0, 1] },
        { key: 'x', rng: ['last draw'], screen: 'end', cursor: [0, 0, 1],
            animation_frames: [{ screen: 'animation', cursor: [0, 0, 1] }] },
    ]);
    assert.deepEqual(h.writes, ['x']);
    assert.deepEqual(h.signals, []);
    assert.equal(h.timers.size, 0);
});

test('early natural exit retains queued frames without sending unused input', async t => {
    const h = harness(t, { moves: 'xy' });
    await drain();
    h.send(input(1, 'start'));
    await drain();
    h.send(input(2, 'game over'));
    h.close();
    const result = await h.done;
    assert.deepEqual(result.steps.map(step => step.key), [null, 'x']);
    assert.equal(result.steps[1].screen, 'game over');
    assert.deepEqual(h.writes, ['x']);
    assert.deepEqual(h.signals, []);
    assert.equal(h.timers.size, 0);
});

test('stream error drains an in-flight read after close without sending another key', async t => {
    const h = harness(t, { moves: 'x' });
    const error = new Error('stdout read failed');
    await drain();
    h.rng('draw\n');
    h.holdRead();
    h.send(input());
    await drain();
    h.child.stdout.emit('error', error);
    await drain();
    assert.deepEqual(h.signals, [{ signal: 'SIGTERM', at: 0 }]);
    h.close(null, 'SIGTERM');
    await drain();
    assert.equal(h.outcome().status, 'pending', 'the RNG read is still in flight');
    h.releaseRead();
    assert.equal((await h.done).error, error);
    assert.deepEqual(h.writes, []);
    assert.equal(h.timers.size, 0);
});

test('natural exit without a frame preserves the empty result for the caller to reject', async t => {
    const h = harness(t, { moves: 'x' });
    await drain();
    h.close();
    const result = await h.done;
    assert.deepEqual(result.steps, []);
    assert.deepEqual(h.signals, []);
    assert.equal(h.timers.size, 0);
});
