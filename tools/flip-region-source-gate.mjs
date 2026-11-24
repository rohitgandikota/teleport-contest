#!/usr/bin/env node
// Pinned source contracts only. This does not execute C or measure coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const bodies = new Map();
const sources = [];
for (const [file, names] of Object.entries({
    sp_lev: ['flip_level', 'lspo_gas_cloud'],
    mkmaze: ['get_level_extends'],
    wizcmds: ['wiz_flip_level'],
    read: ['valid_cloud_pos', 'can_center_cloud', 'display_stinking_cloud_positions',
        'seffect_stinking_cloud', 'do_stinking_cloud'],
    vision: ['does_block', 'vision_reset'],
    region: ['inside_rect', 'inside_region', 'create_region', 'add_rect_to_reg',
        'add_mon_to_reg', 'remove_mon_from_reg', 'mon_in_region', 'free_region',
        'add_region', 'remove_region', 'clear_regions', 'run_regions',
        'in_out_region', 'm_in_out_region', 'update_player_regions',
        'update_monster_region', 'reg_damg', 'any_visible_region',
        'visible_region_summary', 'visible_region_at', 'show_region', 'save_regions',
        'rest_regions', 'reset_region_mids', 'expire_gas_cloud', 'inside_gas_cloud',
        'is_hero_inside_gas_cloud', 'make_gas_cloud', 'create_gas_cloud',
        'create_gas_cloud_selection', 'region_danger', 'region_safety'],
})) {
    const path = `nethack-c/recorder/src/${file}.c`;
    const source = read(path);
    for (const name of names) {
        const match = source.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${path}: ${name}`);
        bodies.set(`${file}.${name}`, match[0]);
        sources.push({ file: path, function: name,
            line: source.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(source) });
    }
}

const passed = [];
const failures = [];
function check(name, fn) {
    try {
        fn();
        passed.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}

const cFlip = bodies.get('sp_lev.flip_level');
const cLoop = cFlip.slice(cFlip.indexOf('/* regions (poison clouds, etc) */'),
    cFlip.indexOf('/* rooms */'));
const jsFlip = read('js/sp_lev.js').match(/^export async function flip_level\([^]*?^}/m)[0];
const jsLoop = jsFlip.match(/    \/\* regions \(poison clouds[^]*?(?=    \/\* rooms)/)?.[0] || '';

check('C visits every active region without extras, visibility, lifetime or area guards', () => {
    assert.match(cLoop, /i = 0; i < svn\.n_regions; i\+\+/);
    assert.doesNotMatch(cLoop, /extras|inFlipArea|visible|ttl|attach_2|monsters/);
});
check('C transforms the bounding box and exactly nrects rectangles on each selected axis', () => {
    for (const [axis, bit, low, high] of [['Y', 1, 'ly', 'hy'], ['X', 2, 'lx', 'hx']]) {
        assert.ok(cLoop.includes(`if (flp & ${bit})`));
        for (const owner of ['bounding_box', 'rects[j]']) {
            assert.ok(cLoop.includes(`tmp1 = Flip${axis}(gr.regions[i]->${owner}.${low})`));
            assert.ok(cLoop.includes(`tmp2 = Flip${axis}(gr.regions[i]->${owner}.${high})`));
            assert.ok(cLoop.includes(`gr.regions[i]->${owner}.${low} = min(tmp1, tmp2)`));
            assert.ok(cLoop.includes(`gr.regions[i]->${owner}.${high} = max(tmp1, tmp2)`));
        }
    }
    assert.equal((cLoop.match(/j < gr\.regions\[i\]->nrects/g) || []).length, 2);
});
check('C region transforms precede room/map updates and the existing final vision reset', () => {
    const at = cFlip.indexOf('/* regions (poison clouds, etc) */');
    assert.ok(cFlip.indexOf('/* level (teleport) regions */') < at);
    assert.ok(at < cFlip.indexOf('/* rooms */'));
    assert.ok(cFlip.indexOf('/* the map */') < cFlip.indexOf('vision_reset();'));
    assert.ok(cFlip.indexOf('if ((flp & 3) == 0)') < at);
});
check('region creation owns separate bounding/rectangle values and registration retains its owner', () => {
    assert.match(bodies.get('region.create_region'), /reg->bounding_box = rects\[0\]/);
    assert.match(bodies.get('region.create_region'), /reg->rects\[i\] = rects\[i\]/);
    assert.match(bodies.get('region.add_rect_to_reg'), /tmp_rect\[reg->nrects\] = \*rect/);
    assert.match(bodies.get('region.add_region'), /gr\.regions\[svn\.n_regions\] = reg/);
    assert.match(read('js/region.js'), /game\.regions\.push\(reg\)/);
});
check('geometry queries and visibility consume the bounding box and ordered active rectangles', () => {
    const inside = bodies.get('region.inside_region');
    assert.match(inside, /inside_rect\(&\(reg->bounding_box\), x, y\)/);
    assert.match(inside, /i < reg->nrects/);
    assert.match(inside, /inside_rect\(&\(reg->rects\[i\]\), x, y\)/);
    assert.match(bodies.get('region.visible_region_at'), /inside_region\(gr\.regions\[i\], x, y\)/);
    assert.match(bodies.get('vision.does_block'), /visible_region_at\(x, y\)/);
    assert.match(bodies.get('vision.vision_reset'), /does_block\(x, y, lev\)/);
});
check('membership and expiry are separate consumers that the flip must not invoke', () => {
    assert.match(bodies.get('region.run_regions'), /gr\.regions\[i\]->ttl--/);
    assert.match(bodies.get('region.expire_gas_cloud'), /damage \/= 2/);
    assert.match(bodies.get('region.expire_gas_cloud'), /reg->ttl = 2L/);
    assert.match(bodies.get('region.mon_in_region'), /reg->monsters\[i\] == mon->m_id/);
    assert.doesNotMatch(cLoop, /run_regions|expire|add_region|remove_region|update_.*region/);
});
check('serialization stores geometry values and independently applies elapsed time on restore', () => {
    const save = bodies.get('region.save_regions');
    const restore = bodies.get('region.rest_regions');
    for (const owner of ['bounding_box', 'rects[j]']) {
        assert.ok(save.includes(`Sfo_nhrect(nhfp, &r->${owner},`));
        assert.ok(restore.includes(`Sfi_nhrect(nhfp, &r->${owner},`));
    }
    assert.match(restore, /svm\.moves - tmstamp/);
    assert.match(restore, /r->ttl - tmstamp : 0L/);
    assert.match(restore, /reset_region_mids\(r\)/);
    assert.match(read('js/region.js'), /regions: structuredClone\(game\.regions \|\| \[\]\)/);
    assert.match(read('js/restore.js'), /rest_regions\(\{ moves: level\._saved_regions_moves/);
});
check('the ordinary scroll producer and explicit wizard choice reach the real C functions', () => {
    assert.match(bodies.get('read.do_stinking_cloud'), /create_gas_cloud\(cc\.x, cc\.y, 15 \+ 10 \* bcsign\(sobj\)/);
    assert.match(bodies.get('region.create_gas_cloud'), /add_rect_to_reg\(cloud, &tmprect\)/);
    assert.match(bodies.get('region.make_gas_cloud'), /add_region\(cloud\)/);
    assert.match(bodies.get('wizcmds.wiz_flip_level'), /flip_level\(\(int\) c, TRUE\)/);
});
check('JS changes only the eight geometry fields and retains the C count/axis guards', () => {
    assert.match(jsLoop, /for \(const reg of \(game\.regions \|\| \[\]\)\)/);
    assert.equal((jsLoop.match(/j < reg\.nrects/g) || []).length, 2);
    assert.deepEqual([...jsLoop.matchAll(/reg\.(bounding_box|rects\[j\])\.(\w+)\s*=(?!=)/g)]
        .map(match => `${match[1]}.${match[2]}`), [
        'bounding_box.ly', 'bounding_box.hy', 'rects[j].ly', 'rects[j].hy',
        'bounding_box.lx', 'bounding_box.hx', 'rects[j].lx', 'rects[j].hx',
    ]);
    assert.doesNotMatch(jsLoop, /extras|inFlipArea|\.ttl|\.visible|attach_2|monsters|\brn2\b|\brnd\b|await|push|splice|sort|create_region|add_region|remove_region/);
    assert.match(jsLoop, /if \(flp & 1\)/);
    assert.match(jsLoop, /if \(flp & 2\)/);
});
check('JS keeps the C region phase before rooms and final vision reset', () => {
    assert.ok(jsLoop.includes('for (const reg'));
    const at = jsFlip.indexOf(jsLoop);
    assert.ok(jsFlip.indexOf('game.lregions') < at);
    assert.ok(at < jsFlip.indexOf('/* rooms'));
    assert.ok(at < jsFlip.indexOf('vision_reset();'));
});

console.log(JSON.stringify({ evidence: 'source-only; no native execution',
    passed: passed.length, total: passed.length + failures.length, checks: passed,
    failures, sources }, null, 4));
process.exitCode = failures.length ? 1 : 0;
