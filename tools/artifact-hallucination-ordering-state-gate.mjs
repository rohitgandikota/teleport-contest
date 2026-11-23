// A controlled pending setter proves which callers wait for completion.
// No production repair is proposed by this instrumentation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { set_artifact_intrinsic } from '../js/artifact.js';
import { setworn, setnotworn } from '../js/worn.js';
import { setuwep, setuwep_with_feedback, uwepgone } from '../js/wield.js';
import { oname } from '../js/do_name.js';
import { mksobj } from '../js/mkobj.js';
import { ART_GRAYSWANDIR } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { W_WEP, ONAME_NO_FLAGS } from '../js/const.js';
const base = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];

for (const entry of ['awaited setter control', 'setworn gain', 'setworn replacement',
    'setnotworn', 'setuwep', 'setuwep_with_feedback', 'uwepgone', 'oname']) {
    test(`${entry} waits at the C setter boundary`, async () => {
        await runSegment({ ...base, moves: ' ', storage: new InMemoryStorage() });
        const obj = mksobj(ONAMES.SILVER_SABER, false, false);
        const replacement = mksobj(ONAMES.DAGGER, false, false);
        if (entry !== 'oname') { obj.oartifact = ART_GRAYSWANDIR; obj.oname = 'Grayswandir'; }
        game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = 7;
        game.u.uwep = null; game.unweapon = true;
        if (['setworn replacement', 'setnotworn', 'uwepgone', 'oname'].includes(entry)) {
            game.u.uwep = obj; obj.owornmask = W_WEP; game.unweapon = false;
        }
        let release;
        const paused = new Promise(resolve => { release = resolve; });
        let reached = 0, finished = false, completion;
        globalThis.__artifactHalresAuditPause = (target, on, mask) => {
            if (target.oartifact === ART_GRAYSWANDIR && mask === W_WEP) {
                reached++;
                return paused;
            }
            return null;
        };
        try {
            let result;
            switch (entry) {
            case 'awaited setter control': result = set_artifact_intrinsic(obj, true, W_WEP); break;
            case 'setworn gain': result = setworn(obj, W_WEP); break;
            case 'setworn replacement': result = setworn(replacement, W_WEP); break;
            case 'setnotworn': result = setnotworn(obj); break;
            case 'setuwep': result = setuwep(obj); break;
            case 'setuwep_with_feedback': result = setuwep_with_feedback(obj); break;
            case 'uwepgone': result = uwepgone(); break;
            case 'oname': result = oname(obj, 'Grayswandir', ONAME_NO_FLAGS); break;
            }
            completion = Promise.resolve(result).then(() => { finished = true; });
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(reached, 1, 'the controlled setter was reached');
            assert.equal(finished, false, 'C finishes set_artifact_intrinsic before returning to this caller');
        } finally {
            release();
            await completion;
            delete globalThis.__artifactHalresAuditPause;
        }
    });
}
