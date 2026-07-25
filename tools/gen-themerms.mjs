#!/usr/bin/env node
// gen-themerms.mjs — embed dat/themerms.lua's room tables as js/themerms_data.js
//
// themerooms_generate() picks one room per call by reservoir sampling over the
// eligible entries, so the ORDER and the FREQUENCY of both tables are part of
// the PRNG contract: get one frequency wrong and every level after the first
// themed room diverges. That table had been transcribed by hand.
//
// Also extracts the `des.map{ map = [[...]] }` block each shaped room stamps
// onto the level, because lspo_map() derives its two placement draws from the
// map's width and height:
//
//     x = 1 + rn2(COLNO - 1 - mf->wid)     sp_lev.c:6154
//     y = rn2(ROWNO - mf->hei)             sp_lev.c:6164
//
// Usage: node tools/gen-themerms.mjs
//
// Requires nethack-c/recorder/lib/lua-5.4.8/src/lua from build-recorder.sh.
// The output is checked in; re-run it only when upstream themerms.lua changes.

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LUA = join(ROOT, 'nethack-c/recorder/lib/lua-5.4.8/src/lua');
const SRC = join(ROOT, 'nethack-c/upstream/dat/themerms.lua');
const OUT = join(ROOT, 'js/themerms_data.js');

if (!existsSync(LUA)) {
    console.error(`missing ${LUA}\nrun nethack-c/build-recorder.sh first`);
    process.exit(2);
}

// Load the file with the real interpreter, with des/nh/selection stubbed to
// no-ops so the top-level table definitions evaluate. Only the metadata is read
// here; the `contents` functions are Lua closures and stay in the C.
const DUMPER = `
local function noop() end
local stub = setmetatable({}, {__index = function() return noop end})
des, nh, selection, obj, monster = stub, stub, stub, stub, stub
function percent() return false end
function shuffle(t) return t end
dofile(arg[1])
local function esc(s)
  return (s:gsub('[%c"\\\\]', function(c)
    if c == '"' then return '\\\\"' end
    if c == '\\\\' then return '\\\\\\\\' end
    if c == '\\n' then return '\\\\n' end
    return string.format('\\\\u%04x', c:byte())
  end))
end
local function dump(tbl)
  local out = {}
  for i, r in ipairs(tbl) do
    out[#out+1] = string.format(
      '{"index":%d,"name":%s,"frequency":%s,"mindiff":%s,"maxdiff":%s}',
      i, r.name and ('"' .. esc(r.name) .. '"') or 'null',
      r.frequency or 1, r.mindiff or 'null', r.maxdiff or 'null')
  end
  return '[' .. table.concat(out, ',') .. ']'
end
io.write('{"themerooms":' .. dump(themerooms)
         .. ',"themeroom_fills":' .. dump(themeroom_fills) .. '}')
`;

const meta = JSON.parse(execFileSync(LUA, ['-', SRC], {
    input: DUMPER, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}));

// The map blocks are Lua long strings inside the closures, so the interpreter
// never exposes them. Scrape them from the source and attach each to the room
// whose `name = '...'` most recently preceded it.
const src = readFileSync(SRC, 'utf8');
const maps = {};
{
    const nameRe = /name\s*=\s*['"]([^'"]+)['"]/g;
    const names = [];
    let m;
    while ((m = nameRe.exec(src)) !== null) names.push({ at: m.index, name: m[1] });

    const mapRe = /des\.map\(\{[^}]*?map\s*=\s*\[\[\n?([\s\S]*?)\]\]([\s\S]{0,120})/g;
    while ((m = mapRe.exec(src)) !== null) {
        let owner = null;
        for (const n of names) { if (n.at < m.index) owner = n.name; else break; }
        if (!owner) continue;
        const rows = m[1].replace(/\n$/, '').split('\n');
        /* the tail right after the map literal, so a one-line
           `contents = function(m) filler_region(1,1); end` is captured whole */
        const f = /^,\s*contents\s*=\s*function\s*\(\s*m\s*\)\s*filler_region\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?\s*end/
                  .exec(m[2]);
        (maps[owner] ||= []).push({
            rows,
            filler: f ? [Number(f[1]), Number(f[2])] : undefined,
        });
    }
}

// `eligible = function(rm) ... end` is a Lua closure, so the interpreter cannot
// hand it over either. It changes how many draws the reservoir sample makes, so
// it has to come across. Capture its body verbatim and let the consumer decide
// whether it understands it — a fill whose predicate is not recognised must be
// reported, never silently treated as eligible.
{
    const entryRe = /name\s*=\s*['"]([^'"]+)['"]([\s\S]{0,400}?)contents\s*=\s*function/g;
    let m;
    while ((m = entryRe.exec(src)) !== null) {
        const e = /eligible\s*=\s*function\s*\(\s*rm\s*\)\s*(.*?)\s*end\s*,/.exec(m[2]);
        if (!e) continue;
        for (const tbl of [meta.themerooms, meta.themeroom_fills])
            for (const r of tbl)
                if (r.name === m[1]) r.eligible = e[1];
    }
}

for (const r of meta.themerooms) {
    const got = maps[r.name];
    if (got) {
        r.maps = got.map(m => ({
            wid: Math.max(...m.rows.map(l => l.length)),
            hei: m.rows.length,
            rows: m.rows,
            /* `contents = function(m) filler_region(A,B); end` is the whole
               body for 17 of the 19 shaped rooms. Where it is not, `filler`
               is absent and the room needs its contents read by hand. */
            filler: m.filler,
        }));
    }
}

const withMaps = meta.themerooms.filter(r => r.maps).length;
const body = `// themerms_data.js — GENERATED by tools/gen-themerms.mjs. Do not edit.
// Source: dat/themerms.lua, loaded with the real Lua 5.4.8 interpreter.
//
// themerooms_generate() reservoir-samples one entry per call:
//
//     total_frequency = total_frequency + this_frequency
//     if this_frequency > 0 and nh.rn2(total_frequency) < this_frequency then
//        pick = i
//
// so BOTH the order and the frequencies are part of the PRNG contract, and
// mindiff/maxdiff change which entries are eligible at a given level.
//
// ${meta.themerooms.length} themerooms (${withMaps} of them stamp a des.map),
// ${meta.themeroom_fills.length} themeroom_fills.

export const themerooms = ${JSON.stringify(meta.themerooms, null, 1)};

export const themeroom_fills = ${JSON.stringify(meta.themeroom_fills, null, 1)};
`;

writeFileSync(OUT, body);
console.log(`wrote ${OUT}: ${meta.themerooms.length} themerooms `
            + `(${withMaps} with maps), ${meta.themeroom_fills.length} fills`);
