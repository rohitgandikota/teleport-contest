#!/usr/bin/env node
// Real command inputs for pinned C chwepon and its property/type contracts.
// Run: node --test tools/chwepon-input-gate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Blind, Hallucination, Halluc_resistance } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_MAGICBANE } from '../js/artilist_data.js';
const inputs = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/generated/chwepon-boundaries.session.json', import.meta.url)));
const labels = [
    "tin-opener-resistant-hallucination",
    "magicbane-negative",
    "zero-amount-survives",
    "tin-opener-sighted",
    "tin-opener-blindfolded",
    "tooth-stack-positive",
    "crysknife-stack-negative"
];
const object = o => o && ({id:o.o_id,type:o.otyp,quantity:o.quan,spe:o.spe,cursed:o.cursed,
    blessed:o.blessed,bknown:o.bknown,proof:o.oerodeproof || 0,where:o.where,weight:o.owt,
    artifact:o.oartifact || 0,name:o.oname,letter:o.invlet,unpaid:o.unpaid || 0});
assert.equal(inputs.segments.length, labels.length);
const results = [];
const hooks = ['__step_snapshot','__rng_trace_sites'];
for (const [index,segment] of inputs.segments.entries()) {
    const states = [];
    let run;
    const previous = hooks.map(key => Object.getOwnPropertyDescriptor(globalThis,key));
    try {
        globalThis.__rng_trace_sites = false;
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            if (!g.invent) return; // Character selection precedes inventory initialization.
            states[step] = {step,weapon:object(g.u.uwep),armor:object(g.u.uarm),
                scrolls:g.invent.filter(o => o.otyp === ONAMES.SCR_ENCHANT_WEAPON).map(object),
                blind:!!Blind(),blindCache:!!g.u.ublind,hallucinating:!!Hallucination(),
                resistance:!!Halluc_resistance(),timeout:g.u.uprops?.HALLUC || 0,
                beginner:!!g.flags.beginner,confused:!!(g.u.intrinsic?.HConfusion || g.u.uprops?.CONFUSION),
                scrollKnown:!!g.objects[ONAMES.SCR_ENCHANT_WEAPON].oc_name_known};
            globalThis.__rng_trace_sites = !!g.u.uwep;
        }};
        run = await runSegment({...segment,storage:new InMemoryStorage()});
    } finally {
        for (const [i,key] of hooks.entries()) {
            if (previous[i]) Object.defineProperty(globalThis,key,previous[i]);
            else delete globalThis[key];
        }
    }
    assert.deepEqual(hooks.map(key => Object.getOwnPropertyDescriptor(globalThis,key)),previous);
    const screens = run.getScreens();
    const read = screens.findIndex(screen => screen.startsWith('What do you want to read?'));
    assert.ok(read >= 0, labels[index] + ' reaches the real scroll selection');
    const rows = screens.flatMap((screen,step) => {
        const text = screen.split('\n')[0];
        return /much (sharper|duller)|glow|tingles|itches|flinches|evaporat|vibrat|strange feeling|normal feeling/.test(text)
            ? [{step,text}] : [];
    });
    const rng = run.getRngSlices().flat().filter(call => / @js\/(wield|read)\.js:/.test(call));
    const result = {name:labels[index],boundaries:screens.length,rngCalls:run.getRngLog().length,
        read,before:states[read],after:states.at(-1),rows,rng,
        hooksRestored:true,
        evidence:'Observed via normal imports; assertions derive from pinned C'};
    results.push(result);
    console.log(JSON.stringify(result));
}

const get = name => results.find(r => r.name === name);
const text = r => r.rows.map(row => row.text).join('\n');
const calls = r => r.rng.map(call => call.split(' @')[0]);

test('C wield.c:932 retains tin-opener beatitude knowledge under resisted hallucination', () => {
    const r = get('tin-opener-resistant-hallucination');
    assert.equal(r.before.armor.type, ONAMES.GOLD_DRAGON_SCALE_MAIL);
    assert.ok(r.before.timeout > 0 && r.before.resistance && !r.before.hallucinating);
    assert.equal(r.before.weapon.type, ONAMES.TIN_OPENER);
    assert.equal(r.before.weapon.cursed, 1);
    assert.equal(r.before.weapon.bknown, 1);
    assert.equal(r.after.weapon.cursed, 0);
    assert.equal(r.after.weapon.bknown, 1);
});
test('C potion.c:1465 chooses strange feeling when hallucination is resisted', () => {
    const r = get('tin-opener-resistant-hallucination');
    assert.ok(r.before.beginner && r.before.timeout > 0 && r.before.resistance);
    assert.equal(r.before.hallucinating, false);
    assert.match(text(r), /have a strange feeling for a moment/);
    assert.doesNotMatch(text(r), /have a normal feeling for a moment/);
});
test('C wield.c:993 and artifact.c:612 protect restricted Magicbane from negative enchantment', () => {
    const r = get('magicbane-negative');
    assert.equal(r.before.weapon.type, ONAMES.ATHAME);
    assert.equal(r.before.weapon.name, 'Magicbane');
    assert.equal(r.before.weapon.artifact, ART_MAGICBANE);
    assert.equal(r.before.weapon.spe, 0);
    assert.equal(r.before.scrolls[0].cursed, 1);
    assert.equal(r.before.blind, false);
    assert.equal(r.after.weapon.spe, 0);
    assert.match(text(r), /faintly glows black/);
});
test('C read.c:1669 supplies integer zero and wield.c:1014 emits violently glows', () => {
    const r = get('zero-amount-survives');
    assert.equal(r.before.weapon.type, ONAMES.DAGGER);
    assert.equal(r.before.weapon.spe, 9);
    assert.equal(r.before.scrolls[0].cursed, 0);
    assert.equal(r.before.confused, false);
    const zero = calls(r).find(call => call.startsWith('rn2(9)='));
    assert.ok(zero && zero !== 'rn2(9)=0', 'nonzero comparison result gives C integer zero');
    assert.ok(calls(r).includes('rn2(3)=0'), 'soft-limit survival is real input RNG');
    assert.equal(r.after.weapon.spe, 9);
    assert.match(text(r), /violently glows blue for a while/);
});
test('positive control: sighted tin opener uncurses and retains beatitude knowledge', () => {
    const r = get('tin-opener-sighted');
    assert.equal(r.before.hallucinating, false);
    assert.equal(r.after.weapon.cursed, 0);
    assert.equal(r.after.weapon.bknown, 1);
    assert.match(text(r), /have a strange feeling for a moment/);
    assert.equal(r.after.scrolls.length, 0);
});
test('positive control: actual blindfold keeps canonical Blind and cache in agreement', () => {
    const r = get('tin-opener-blindfolded');
    assert.equal(r.before.blind, true);
    assert.equal(r.before.blindCache, true);
    assert.equal(r.after.weapon.cursed, 0);
    assert.equal(r.after.weapon.bknown, r.before.weapon.bknown);
});
test('positive control: three cursed teeth fuse and uncurse before any floor release', () => {
    const r = get('tooth-stack-positive');
    assert.equal(r.before.weapon.type, ONAMES.WORM_TOOTH);
    assert.equal(r.before.weapon.quantity, 3);
    assert.equal(r.before.weapon.cursed, 1);
    assert.equal(r.after.weapon.type, ONAMES.CRYSKNIFE);
    assert.equal(r.after.weapon.quantity, 1);
    assert.equal(r.after.weapon.proof, 0);
    assert.equal(r.after.weapon.cursed, 0);
    assert.equal(r.before.weapon.weight, 60);
    assert.equal(r.after.weapon.weight, 20);
    assert.equal(r.after.scrollKnown, true);
    assert.match(text(r), /fuse, and become much sharper/);
});
test('positive control: three fixed crysknives fuse to one unproofed tooth', () => {
    const r = get('crysknife-stack-negative');
    assert.equal(r.before.weapon.type, ONAMES.CRYSKNIFE);
    assert.equal(r.before.weapon.quantity, 3);
    assert.equal(r.before.weapon.proof, 1);
    assert.equal(r.after.weapon.type, ONAMES.WORM_TOOTH);
    assert.equal(r.after.weapon.quantity, 1);
    assert.equal(r.after.weapon.proof, 0);
    assert.equal(r.after.weapon.spe, 2);
    assert.equal(r.before.weapon.weight, 60);
    assert.equal(r.after.weapon.weight, 20);
    assert.match(text(r), /fuse, and become much duller/);
});
