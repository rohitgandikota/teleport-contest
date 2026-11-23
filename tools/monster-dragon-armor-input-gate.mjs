// C mon.c:5197-5207. Real command inputs; no gameplay mutation or helper overrides.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { which_armor } from '../js/worn.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { W_ARM } from '../js/const.js';

const input = normalizeSession(JSON.parse(readFileSync(process.argv[2], 'utf8')));
assert.equal(input.segments.length, 3);
for (const [index, segment] of input.segments.entries()) {
    test(segment.name, async () => {
        const id = [65, 64, 65][index];
        const preHitStep = [213, 212, 153][index];
        const states = [];
        const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        globalThis.__step_snapshot = { step: '*', cb(g, step) {
            const mon = g.level.monsters.find(m => m.m_id === id);
            const armor = mon && which_armor(mon, W_ARM);
            const heldMail = mon?.minvent?.find(o => o.otyp === ONAMES.GOLD_DRAGON_SCALE_MAIL);
            const wand = g.invent.find(o => o.otyp === ONAMES.WAN_POLYMORPH);
            states[step] = { control:!!g.flags.monpolycontrol,
                hero:[g.u.ux,g.u.uy], target:mon && {
                    type:mon.mnum, base:mon.cham, x:mon.mx, y:mon.my,
                    armor:armor?.otyp, heldMailMask:heldMail?.owornmask || 0,
                    holdsMail:!!heldMail
                }, wand:wand && { letter:wand.invlet, charges:wand.spe } };
        }};
        let run;
        try { run = await runSegment({...segment, storage:new InMemoryStorage()}); }
        finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
        const before = states[preHitStep];
        assert.equal(before.control, false);
        assert.deepEqual(before.hero, [44,5]);
        assert.equal(before.target.type, PMNAMES.PM_SOLDIER);
        assert.equal(before.target.base, -1);
        assert.equal(before.target.x, 43);
        assert.equal(before.target.y, 5);
        assert.equal(before.target.armor, [
            ONAMES.GOLD_DRAGON_SCALE_MAIL, ONAMES.GOLD_DRAGON_SCALES, ONAMES.RING_MAIL
        ][index]);
        if (index === 2) {
            assert.equal(before.target.holdsMail, true);
            assert.equal(before.target.heldMailMask, 0);
        }
        assert.deepEqual(before.wand, { letter:index === 2 ? 'p' : 'q', charges:19 });
        assert.equal(states[preHitStep - 2].wand.charges, 20);
        assert.equal(run.getScreens().length, [224,223,164][index]);
        assert.equal(states[preHitStep + 1].target.type,
            index === 2 ? PMNAMES.PM_PIT_FIEND : PMNAMES.PM_GOLD_DRAGON);
        assert.equal(states.at(-1).target.base, -1);
        assert.equal(states.at(-1).target.type,
            index === 2 ? PMNAMES.PM_PIT_FIEND : PMNAMES.PM_GOLD_DRAGON);
        assert.ok(!run.getScreens().at(-1).includes('--More--'));
    });
}
