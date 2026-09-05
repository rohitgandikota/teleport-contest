#!/usr/bin/env node

// C mkobj.c:1746-1838, invent.c:1187 and apply.c:2398. Replay checks cover
// state omitted from terminal output. Separate source controls earn no C credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { bless, curse, unbless, uncurse, mksobj, place_object } from '../js/mkobj.js';
import { addinv, freeinv, obj_extract_self } from '../js/invent.js';
import { mpickobj } from '../js/steal.js';
import { study_book } from '../js/spell.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { start_timer, stop_timer, run_timers, TIMER_OBJECT, FIG_TRANSFORM }
    from '../js/timeout.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, MFLAGS } from '../js/monst_data.js';
import { OBJ_INVENT, OBJ_FLOOR, OBJ_CONTAINED, OBJ_MINVENT, W_WEP,
         HWALL, FROMOUTSIDE } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const figs = () => game.timer_base.filter(t => t.func_index === FIG_TRANSFORM);
let count = 0;
for (const name of ['beatitude-shared', 'beatitude-light-equipment',
                    'figurine-timers', 'beatitude-lifecycle']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const oracle = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        const events = new Map();
        let original, previousMove;
        globalThis.__step_snapshot = { step: '*', cb: state => {
            for (const timer of state.timer_base || []) {
                if (timer.func_index !== FIG_TRANSFORM)
                    continue;
                original ||= timer.arg;
                if (!events.has(timer.tid))
                    events.set(timer.tid, { start: previousMove ?? state.moves,
                        timeout: timer.timeout });
            }
            previousMove = state.moves;
        } };
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        const draws = oracle.segments[i].steps.flatMap(t => t.rng || [])
            .filter(r => r.includes('attach_fig_transform_timeout'))
            .map(r => Number(/=(\d+)/.exec(r)[1]));
        assert.equal(events.size, draws.length, segment.name + ': C timer attachments');
        for (const [j, event] of [...events.values()].entries())
            assert.equal(event.timeout, event.start + draws[j] + 200,
                segment.name + ': C timer deadline');

        const target = game.invent.find(o => o.invlet === 'a');
        const effect = segment.name.replace(/-blind$/, '').split('-').at(-1);
        const buc = [effect === 'bless', effect === 'curse'];
        if (name === 'beatitude-shared') {
            assert.deepEqual([!!target.blessed, !!target.cursed], buc);
            if (segment.name.startsWith('bag-')) {
                assert.equal(target.cobj.length, 1);
                assert.equal(target.cobj[0].otyp, ONAMES.APPLE);
                assert.equal(target.cobj[0].quan, 20);
                // C objects.h: bag weighs 15, apples 2 each. C mkobj.c:1915
                // quarters blessed contents, halves uncursed, doubles cursed.
                assert.equal(target.owt, { bless: 25, curse: 95,
                    unbless: 35, uncurse: 35 }[effect]);
            } else if (segment.name.startsWith('luckstone-')) {
                assert.equal(game.u.moreluck, effect === 'curse' ? -3 : 3);
            } else {
                assert.equal(target.timed | 0, effect === 'curse' ? 1 : 0);
                assert.equal(figs().length, target.timed | 0);
            }
        } else if (segment.name.startsWith('light-')
                   || segment.name.startsWith('armor-')) {
            assert.deepEqual([!!target.blessed, !!target.cursed], buc);
            assert.ok(target.lamplit);
            const light = game.light_sources.find(l => l.id === target.o_id);
            assert.ok(light);
            assert.equal(light.range, (effect === 'bless' ? 3 : effect === 'curse' ? 1 : 2)
                + Number(segment.name.startsWith('armor-')));
        } else if (segment.name === 'alternate-curse') {
            assert.equal(!!game.u.twoweap, false);
            assert.ok(!game.u.uswapwep);
            assert.equal(game.u.uwep.invlet, 'b');
            const dagger = game.level.objects.find(o => o.otyp === ONAMES.DAGGER);
            assert.ok(dagger.cursed);
            assert.equal(dagger.where, OBJ_FLOOR);
            assert.equal(dagger.owornmask | 0, 0);
        } else if (segment.name === 'twohanded-curse') {
            assert.equal(game.u.uwep, target);
            assert.ok(target.cursed);
            assert.equal(game.context_takeoff.mask, 0);
        } else if (name === 'figurine-timers' || segment.name === 'apply') {
            assert.ok(original);
            assert.equal(original.timed, 0);
            assert.ok(!game.invent.includes(original));
            assert.equal(figs().length, 0);
            const kitten = game.level.monsters.find(m => m.mnum === PMNAMES.PM_KITTEN);
            assert.equal(!!kitten, segment.name !== 'transform-creation-disabled');
            if (kitten) {
                assert.equal(!!kitten.mtame, false);
                // C's chance==1 leaves makemon's disposition unchanged.
                // Here peace_minded rolled zero, so even that kitten is hostile.
                if (segment.name.endsWith('-blind'))
                    assert.ok(oracle.segments[i].steps.some(t => (t.rng || [])
                        .includes('rn2(16)=0 @ peace_minded(makemon.c:2306)')));
                assert.equal(!!kitten.mpeaceful, false);
            }
        } else if (segment.name === 'drop') {
            assert.equal(original.where, OBJ_FLOOR);
            assert.ok(game.level.objects.includes(original));
            assert.equal(original.timed, 0);
            assert.equal(figs().length, 0);
        } else if (segment.name === 'pickup') {
            assert.equal(original, target);
            assert.equal(target.where, OBJ_INVENT);
            assert.equal(target.timed, 1);
            assert.equal(figs().length, 1);
        } else if (segment.name === 'stash') {
            const bag = game.invent.find(o => o.otyp === ONAMES.BAG_OF_HOLDING);
            assert.deepEqual(bag.cobj, [original]);
            assert.equal(original.where, OBJ_CONTAINED);
            assert.equal(original.timed, 0);
            assert.equal(figs().length, 0);
        }
        for (const obj of game.invent)
            assert.equal(!!obj.in_use, false);
        count++;
    }
}

// C construction paths must finish their state changes before returning,
// even though equipped objects can return pending messages.
const coin = mksobj(ONAMES.GOLD_PIECE, false, false);
bless(coin);
const coinCurse = curse(coin);
assert.deepEqual([!!coin.blessed, !!coin.cursed], [false, false]);
await coinCurse;
const fig = mksobj(ONAMES.FIGURINE, false, false);
fig.corpsenm = PMNAMES.PM_KITTEN;
const construction = curse(fig);
assert.equal(fig.cursed, 1);
assert.equal(fig.timed | 0, 0);
await construction;

// Monster acquisition starts the same timer before the free object joins
// minvent. Extinction permits it; genocide of the baby form forbids an adult.
const carrier = game.level.monsters[0];
mpickobj(carrier, fig);
assert.equal(fig.where, OBJ_MINVENT);
assert.equal(fig.ocarry, carrier);
assert.equal(fig.timed, 1);
await curse(fig);
assert.equal(fig.timed, 1, 'recursing replaces, rather than duplicates, its timer');
assert.equal(figs().filter(t => t.arg === fig).length, 1);
unbless(fig);
assert.equal(fig.timed, 1, 'unblessing does not stop a cursed figurine timer');
bless(fig);
assert.equal(fig.timed, 0);
await curse(fig);
assert.equal(fig.timed, 1);
uncurse(fig);
assert.equal(fig.timed, 0);
obj_extract_self(fig);
fig.corpsenm = PMNAMES.PM_HOUSECAT;
const baby = game.mvitals[PMNAMES.PM_KITTEN];
const originalFlags = baby.mvflags;
baby.mvflags |= MFLAGS.G_GENOD;
curse(fig);
addinv(fig);
assert.equal(fig.timed, 0, 'baby genocide blocks adult carrying timer');
freeinv(fig);
baby.mvflags = originalFlags | MFLAGS.G_EXTINCT;
addinv(fig);
assert.equal(fig.timed, 1, 'extinction does not block a figurine');
freeinv(fig);
assert.equal(fig.timed, 0);
baby.mvflags = originalFlags;

// A floor figurine in impassable rock retries quietly, retaining ownership.
// This state can follow a wall-passing carrier's death or object relocation.
const x = game.u.ux - 1, y = game.u.uy;
const oldType = game.level.at(x, y).typ;
game.level.at(x, y).typ = HWALL;
place_object(fig, x, y);
start_timer(0, TIMER_OBJECT, FIG_TRANSFORM, fig);
enableRngLog();
const before = getRngLog().length;
await run_timers();
const retry = getRngLog().slice(before);
assert.equal(retry.length, 1);
assert.match(retry[0], /^rnd\(5000\)=/);
assert.equal(figs()[0].timeout, game.moves + Number(/=(\d+)/.exec(retry[0])[1]));
assert.equal(fig.where, OBJ_FLOOR);
assert.equal(fig.timed, 1);
stop_timer(FIG_TRANSFORM, fig);
game.level.at(x, y).typ = oldType;

// reset_remarm clears only C's saved selection, preserving the delay and
// other context fields. C calls it when a wielded bimanual weapon welds.
const sword = mksobj(ONAMES.TWO_HANDED_SWORD, false, false);
sword.where = OBJ_INVENT;
sword.owornmask = W_WEP;
game.u.uwep = sword;
const takeoff = game.context_takeoff = { mask: 17, what: 1, delay: 9,
    disrobing: 'disrobing', cancelled_don: true };
await curse(sword);
assert.equal(game.context_takeoff, takeoff);
assert.deepEqual(takeoff, { mask: 0, what: 0, delay: 9,
    disrobing: '', cancelled_don: true });

// Start real study, then apply C's occupation, book identity, multi and
// already-cursed guards. Extra keys only acknowledge source-control messages.
game._preNhgetchHook = null;
pushKeys(' '.repeat(40));
game.u.intrinsic.HSleep_resistance = FROMOUTSIDE;
game.spl_book = [];
game.context.spbook = {};
const book = mksobj(ONAMES.SPE_FINGER_OF_DEATH, false, false);
bless(book);
await addinv(book);
await study_book(book);
const learning = game.occupation;
assert.ok(learning);
const otherBook = mksobj(ONAMES.SPE_HEALING, false, false);
await curse(otherBook);
assert.equal(game.occupation, learning);
game.multi = -1;
await curse(book);
assert.equal(game.occupation, learning);
game.multi = 0;
await curse(book);
assert.equal(game.occupation, learning, 'already cursed does not interrupt again');
uncurse(book);
await curse(book);
assert.equal(game.occupation, null);
assert.equal(book.bknown, 1);
assert.equal(game.context.spbook.book, book, 'interruption preserves study progress');
assert.ok(game.context.spbook.delay < 0);
resetInputState();

console.log(`beatitude state: ${count} C cases and source controls PASS`);
