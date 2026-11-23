#!/usr/bin/env node
// Read-only actual-input conditions and outcomes for the nine native cases.
// These observations complement native replay; they are not a native oracle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { Levitation, Invis, Conflict, Blind, Hallucination, Flying } from '../js/youprop.js';
import { ART_HEART_OF_AHRIMAN, ART_ORB_OF_DETECTION, ART_SCEPTRE_OF_MIGHT } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { W_ART, W_ARTI, W_RINGL, OBJ_FREE, OBJ_INVENT, OBJ_FLOOR } from '../js/const.js';

// Four inventory-loss cases and their ownership controls.
{
    const { segments } = JSON.parse(readFileSync(new URL('gen-sessions/recipes/artifact-invoked-property-loss.json', import.meta.url)));
    const cases = [
        { artifact: ART_HEART_OF_AHRIMAN, prop: 'LEVITATION', intrinsic: 'HLevitation', active: Levitation,
            role: 'Barbarian', align: 0, ring: true },
        { artifact: ART_ORB_OF_DETECTION, prop: 'INVIS', intrinsic: 'HInvis', active: Invis,
            role: 'Archeologist', align: 1 },
        { artifact: ART_SCEPTRE_OF_MIGHT, prop: 'CONFLICT', intrinsic: 'HConflict', active: Conflict,
            role: 'Caveman', align: 1 },
        { artifact: ART_HEART_OF_AHRIMAN, prop: 'LEVITATION', intrinsic: 'HLevitation', active: Levitation,
            role: 'Barbarian', align: 0, ring: true, worn: true },
    ];
    const objectState = o => o ? { id: o.o_id, type: o.otyp, artifact: o.oartifact || 0,
        where: o.where, age: o.age || 0, letter: o.invlet, name: o.oname,
        worn: o.owornmask || 0,
        inUse: !!o.in_use, howLost: o.how_lost || 0, weight: o.owt,
        x: o.ox, y: o.oy } : null;
    for (const [index, part] of segments.entries()) {
        const c = cases[index], states = [], messages = [];
        const hooks = ['__step_snapshot', '__rng_trace_sites'];
        const previous = hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
        let artifact, ring, run;
        function state(step) {
            artifact ||= (game.invent || []).find(o => o.oartifact === c.artifact);
            ring ||= (game.invent || []).find(o => o.otyp === ONAMES.RIN_LEVITATION);
            return { step, move: game.moves, role: game.urole?.name?.m, align: game.u.ualign?.type,
                hp: game.u.uhp, mask: game.u.uprops?.[c.prop] || 0,
                intrinsic: game.u.intrinsic?.[c.intrinsic] || 0,
                blocked: game.u.blocked?.[c.prop] || 0, active: !!c.active(),
                blind: !!Blind(), hallucinating: !!Hallucination(),
                swallowed: !!game.u.uswallow, trapped: game.u.utrap || 0,
                terrain: game.level.at(game.u.ux, game.u.uy).typ,
                artifact: objectState(artifact), ring: objectState(ring),
                carried: (game.invent || []).includes(artifact),
                floor: (game.level.objects || []).includes(artifact) };
        }
        try {
            globalThis.__rng_trace_sites = true;
            globalThis.__step_snapshot = { step: '*', cb(g, step) {
                states.push(state(step));
                const text = g.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
                if (text !== messages.at(-1)?.text) messages.push({ step, text });
            } };
            run = await runSegment({ ...part, storage: new InMemoryStorage() });
        } finally {
            for (const [i, key] of hooks.entries()) {
                if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
                else delete globalThis[key];
            }
        }
        assert.deepEqual(hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key)), previous);
        const final = state(states.length - 1);
        const invoked = states.find(s => s.carried && s.active && (s.mask & W_ARTI));
        const drop = messages.find(m => /You drop /.test(m.text));
        assert.ok(invoked, part.name + ': real invocation activated the carried artifact');
        assert.ok(drop, part.name + ': actual drop command reached feedback');
        assert.equal(invoked.role, c.role); assert.equal(invoked.align, c.align);
        assert.equal(invoked.artifact.where, OBJ_INVENT);
        assert.equal(invoked.intrinsic, 0); assert.equal(invoked.blocked, 0);
        assert.equal(invoked.blind, false); assert.equal(invoked.hallucinating, false);
        assert.equal(invoked.swallowed, false); assert.equal(invoked.trapped, 0);
        assert.equal(final.carried, false); assert.equal(final.floor, true);
        assert.equal(final.artifact.where, OBJ_FLOOR);
        assert.equal(final.artifact.id, invoked.artifact.id);
        assert.equal(final.artifact.name, invoked.artifact.name);
        assert.equal(final.artifact.weight, invoked.artifact.weight);
        assert.equal(final.artifact.inUse, false); assert.ok(final.hp > 0);
        if (c.ring) {
            assert.equal(final.ring.where, OBJ_INVENT);
            assert.equal(invoked.ring.worn, c.worn ? W_RINGL : 0);
            assert.equal(invoked.mask, c.worn ? (W_ARTI | W_RINGL) : W_ARTI);
            assert.equal(final.ring.worn, c.worn ? W_RINGL : 0);
            // C do.c's sole-source levitation finesse is a faithful negative control.
            if (!c.worn) {
                assert.ok(states.some(s => s.mask === W_ART && s.artifact?.where === OBJ_FREE),
                    'sole-source Heart reaches the temporary levitation mask before landing');
                assert.equal(final.mask, 0); assert.equal(final.active, false);
            }
            else assert.equal(final.active, true);
        }
        assert.equal(final.mask & W_ARTI, 0, part.name + ': invoked source is removed');
        assert.equal(final.active, !!c.worn, part.name + ': only the worn ring retains the property');
        assert.equal(final.artifact.age > final.move, index !== 0,
            part.name + ': only the sole-source Heart finesse bypasses cooldown');
        if (index === 1) assert.match(messages.map(m => m.text).join('\n'), /body seems to unfade/);
        if (index === 2) assert.match(messages.map(m => m.text).join('\n'), /tension decrease/);
        console.log(JSON.stringify({ name: part.name, boundaries: run.getScreens().length,
            rngCalls: run.getRngLog().length, mask: final.mask, age: final.artifact.age }));
    }
}

// Five property-helper cases with actual status conditions.
{
    const { segments } = JSON.parse(readFileSync(new URL('gen-sessions/recipes/artifact-invoked-property-helpers.json', import.meta.url)));
    for (const [index, segment] of segments.entries()) {
        const states = [], messages = [], heart = index === 4;
        const before = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
        let run;
        try {
            globalThis.__step_snapshot = { step:'*', cb(g,step) {
                states.push({ step, move:g.moves, hp:g.u.uhp,
                    artifact:(g.invent || []).find(o => o.oartifact === (heart ? ART_HEART_OF_AHRIMAN : ART_ORB_OF_DETECTION))?.oartifact || 0,
                    blind:!!Blind(), hallucinating:!!Hallucination(), invisible:!!Invis(), flying:!!Flying(), levitating:!!Levitation(),
                    mask:g.u.uprops?.[heart ? 'LEVITATION' : 'INVIS'] || 0,
                    blockedInvis:g.u.blocked?.INVIS || 0, blockedFlying:g.u.blocked?.FLYING || 0,
                    intrinsicInvis:g.u.intrinsic?.HInvis || 0, intrinsicHalluc:g.u.intrinsic?.HHallucination || 0 });
                const text = g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd();
                if (text !== messages.at(-1)?.text) messages.push({step,text});
            }};
            run = await runSegment({ ...segment, storage:new InMemoryStorage() });
        } finally {
            if (before) Object.defineProperty(globalThis,'__step_snapshot',before);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),before);
        const active = states.filter(s=>s.mask & W_ARTI), final = states.at(-1);
        assert.ok(active.length,segment.name+': actual invocation toggles on');
        assert.ok(active.every(s=>s.artifact)); assert.equal(final.mask & W_ARTI,0); assert.ok(final.hp>0);
        if (index===0) assert.ok(active.every(s=>s.blind && !s.blockedInvis));
        if (index===1) assert.ok(active.every(s=>s.blockedInvis && !s.blind));
        if (index===2) assert.ok(active.every(s=>s.hallucinating && s.intrinsicHalluc>0));
        if (index===3) assert.ok(active.every(s=>s.intrinsicInvis>0));
        if (heart) {
            assert.ok(states.some(s=>s.flying && !(s.mask & W_ARTI)));
            assert.ok(active.every(s=>s.hallucinating && s.levitating));
            assert.equal(final.flying,true);
        }
        const text = messages.map(m => m.text).join('\n');
        if ([0,1,3].includes(index)) {
            assert.match(text, /surge of power/);
            assert.doesNotMatch(text, /transparency|body seems to unfade/);
        } else if (index === 2) {
            assert.match(text, /normal transparency/);
            assert.match(text, /body seems to unfade/);
        } else {
            assert.match(text, /walking on air/);
            assert.match(text, /no longer able to control your flight/);
        }
        console.log(JSON.stringify({ name: segment.name, boundaries: run.getScreens().length,
            rngCalls: run.getRngLog().length, final }));
    }
}
