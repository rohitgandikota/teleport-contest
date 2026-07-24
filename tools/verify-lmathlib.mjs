// verify-lmathlib.mjs — check js/lua/lmathlib.js against the real Lua 5.4.8.
//
// math.random's draws appear NOWHERE in the RNG log (see js/lua/lmathlib.js),
// so nothing in the scoring pipeline will ever tell us this drifted. This is
// the only check there is. Run it after touching lmathlib.js.
//
// Usage: node tools/verify-lmathlib.mjs

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LuaRandom } from '../js/lua/lmathlib.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LUA = join(ROOT, 'nethack-c/recorder/lib/lua-5.4.8/src/lua');
const SEEDS = [0, 1, 8000, 5006, 123456789, 4294967296];

const SCRIPT = `
for _,seed in ipairs{${SEEDS.join(',')}} do
  math.randomseed(seed)
  local t={}
  for i=1,6 do t[#t+1]=math.random(100) end
  for i=1,3 do t[#t+1]=math.random(3,17) end
  for i=1,2 do t[#t+1]=math.random(1) end
  for i=1,2 do t[#t+1]=math.random(255) end
  t[#t+1]=string.format("%.17g", math.random())
  t[#t+1]=tostring(math.random(0))
  print(seed..": "..table.concat(t," "))
end`;

function ours() {
    const lines = [];
    for (const seed of SEEDS) {
        const r = new LuaRandom(seed);
        const t = [];
        for (let i = 0; i < 6; i++) t.push(r.random(100));
        for (let i = 0; i < 3; i++) t.push(r.random(3, 17));
        for (let i = 0; i < 2; i++) t.push(r.random(1));
        for (let i = 0; i < 2; i++) t.push(r.random(255));
        t.push(r.random().toPrecision(17).replace(/0+$/, '').replace(/\.$/, ''));
        t.push(String(r.random(0)));
        lines.push(`${seed}: ${t.join(' ')}`);
    }
    return lines.join('\n');
}

if (!existsSync(LUA)) {
    console.error(`reference interpreter not found at ${LUA}\n`
        + 'run `bash nethack-c/build-recorder.sh` first');
    process.exit(2);
}

const ref = execFileSync(LUA, ['-e', SCRIPT], { encoding: 'utf8' }).trim();
const got = ours().trim();

if (ref === got) {
    console.log(`lmathlib matches the reference interpreter on ${SEEDS.length} seeds`);
    console.log(got.split('\n').map(l => '  ' + l).join('\n'));
} else {
    console.error('MISMATCH\n--- reference ---\n' + ref + '\n--- ours ---\n' + got);
    process.exit(1);
}
