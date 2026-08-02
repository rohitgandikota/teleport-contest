// stepdraws.mjs — compare OUR per-step RNG draws against C's, with C's call
// sites shown. The recorded sessions carry per-step `rng` arrays annotated
// with the C function that made each draw; our runner exposes the same via
// getRngSlices(). Diffing them localizes a divergence to ONE step and names
// the C function we failed to call.
//
//   node tools/stepdraws.mjs seed0030 28 33
import fs from 'fs';
import { runSegment } from '../js/jsmain.js';
const pfx = process.argv[2], lo = +process.argv[3], hi = +process.argv[4];
const f = fs.readdirSync('sessions').find(x => x.startsWith(pfx));
const d = JSON.parse(fs.readFileSync('sessions/' + f));
const sg = d.segments[0];
const g = await runSegment({ seed: sg.seed, datetime: sg.datetime,
                             nethackrc: sg.nethackrc, moves: sg.moves });
const slices = g.getRngSlices();
const bare = s => String(s).replace(/ @.*$/, '');
for (let i = lo; i <= hi; i++) {
    const c = (sg.steps[i].rng || []).map(bare);
    const o = (slices[i] || []).map(bare);
    const same = c.length === o.length && c.every((v, j) => v === o[j]);
    console.log(`step ${i} key=${JSON.stringify(sg.steps[i].key)} C=${c.length} ours=${o.length} ${same ? 'SAME' : 'DIFF'}`);
    if (!same) {
        console.log('   C   :', (sg.steps[i].rng || []).slice(0, 6).join(' | '));
        console.log('   ours:', o.slice(0, 6).join(' | '));
    }
}
