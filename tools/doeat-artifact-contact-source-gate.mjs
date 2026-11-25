// Static pinned-source contracts only. No game or replay is started.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [];
function body(path, name, javascript = false) {
    const text = read(path);
    const prefix = javascript ? '(?:export )?(?:async )?function ' : '';
    const match = text.match(new RegExp(`^${prefix}${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${path}:${name}`);
    sources.push({ path, function: name, line: text.slice(0, match.index).split('\n').length,
        functionSha256: sha(match[0]), fileSha256: sha(text) });
    return match[0];
}
const c = (file, name) => body(`nethack-c/recorder/src/${file}.c`, name);
const js = (file, name) => body(`js/${file}.js`, name, true);
const owner = c('eat', 'doeat');
const port = js('eat', 'doeat');
const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
function ordered(text, ...parts) {
    let offset = -1;
    for (const part of parts) {
        const index = text.indexOf(part, offset + 1);
        assert.ok(index > offset, `missing or misordered: ${part}`);
        offset = index;
    }
}
check('selection and capacity precede edible and worn rejection', () => {
    ordered(owner, 'floorfood("eat", 0)', 'check_capacity(', '!is_edible(otmp)',
        'W_ARMOR | W_TOOL | W_AMUL | W_SADDLE');
    ordered(port, "await floorfood('eat', 0)", 'if (!otmp)', 'await check_capacity(',
        '!is_edible(otmp)', 'W_ARMOR | W_TOOL | W_AMUL | W_SADDLE');
});
check('carried selection awaits retouch while noncarried selection awaits touch', () => {
    assert.match(owner, /carried\(otmp\) \? retouch_object\(&otmp, FALSE\)\s*: touch_artifact\(otmp, &gy.youmonst\)/);
    assert.match(port, /carried\(otmp\) \? await retouch_object\(otmp, false\)\s*: await touch_artifact\(otmp, game.youmonst\)/);
});
check('refused contact costs time before resuming or creating a meal', () => {
    ordered(owner, 'retouch_object(&otmp, FALSE)', 'return ECMD_TIME;',
        'otmp == svc.context.victual.piece', 'touchfood(otmp)');
    ordered(port, 'await retouch_object(otmp, false)', 'return ECMD_TIME;',
        'otmp === game.context.victual?.piece', 'await touchfood(otmp)');
});
check('contact is not restricted to artifact-marked objects', () => {
    const start = port.indexOf('} else if (!(carried(otmp)');
    const block = port.slice(start, port.indexOf('\n    }', start) + 6);
    assert.match(block, /retouch_object/);
    assert.doesNotMatch(block, /oartifact|is_metallic|PM_XORN|PM_RUST_MONSTER/);
});
check('retouch returns immediately on safe contact before ownership changes', () => {
    ordered(c('artifact', 'retouch_object'), 'if (touch_artifact(obj, &gy.youmonst))',
        'if (!ag && !bane)', 'return 1;', 'if (obj->owornmask)', 'remove_worn_item(obj, FALSE)',
        'if (loseit && obj)', 'return 0;');
    ordered(js('artifact', 'retouch_object'), 'if (await touch_artifact(obj, game.youmonst))',
        'if (!ag && !bane)', 'return 1;', 'if (obj.owornmask)', 'await remove_worn_item(obj, false)',
        'if (loseit && obj)', 'return 0;');
});
check('floor selection returns the object without extracting or consuming it', () => {
    const floor = c('eat', 'floorfood');
    const jsfloor = js('eat', 'floorfood');
    ordered(floor, 'otmp = svl.level.objects[u.ux][u.uy]', 'otmp->nexthere',
        'is_edible(otmp)', "== 'y'", 'return  otmp;');
    ordered(jsfloor, 'game.level.objectAt(game.u.ux, game.u.uy)', 'otmp.nexthere',
        'is_edible(otmp)', "=== 'y'", 'return  otmp;');
});
check('edibility protects unique objects and admits actual metallic forms', () => {
    ordered(c('eat', 'is_edible'), 'oc_unique', 'return FALSE;',
        'metallivorous(gy.youmonst.data) && is_metallic(obj)', 'return TRUE;');
    ordered(js('eat', 'is_edible'), 'oc_unique', 'return false;',
        'metallivorous(game.youmonst.data) && is_metallic(obj)', 'return true;');
});
check('declining floor or cancelling inventory returns before contact', () => {
    assert.match(c('eat', 'floorfood'), /else if \(c == 'q'\) \{\s*return \(struct obj \*\) 0;/);
    assert.match(js('eat', 'floorfood'), /else if \(c === 'q'\) \{\s*return null;/);
    ordered(c('invent', 'getobj'), 'strchr(quitchars, ilet)', 'Never_mind', 'return (struct obj *) 0;');
    ordered(js('invent', 'getobj'), 'quitchars.includes(ilet)', 'Never_mind', 'return null;');
});
check('hero blast still awaits feedback before damage and refusal', () => {
    ordered(c('artifact', 'touch_artifact'), 'You("are blasted by', 'touch_blasted = TRUE',
        'd((Antimagic', 'losehp(', 'exercise(A_WIS', 'badclass && badalign && self_willed');
    ordered(js('artifact', 'touch_artifact'), 'await You(', 'touch_blasted = true',
        'd(Antimagic()', 'await losehp(', 'exercise(A_WIS', 'if (!decision.allowed)');
});
check('food ownership and billing occur downstream of contact', () => {
    ordered(c('eat', 'touchfood'), 'splitobj(', 'costly_alteration(', 'obj_nutrition(',
        'freeinv(otmp)', 'addinv_nomerge(otmp)');
    ordered(js('eat', 'touchfood'), 'splitobj(', 'await costly_alteration(', 'obj_nutrition(',
        'await freeinv(otmp)', 'addinv_nomerge(otmp)');
    ordered(port, 'await touch_artifact(otmp, game.youmonst)', 'await touchfood(otmp)');
});
console.log(JSON.stringify({ evidence: 'static C/JS source only, no replay or native reach claim',
    passed: checks.length, total: checks.length + failures.length, checks, failures, sources,
    limits: ['This gate is static; runtime state results and pending ordinary input checks have separate receipts.',
        'Missing nonfood, edibility-prompt and iron-bar special handling stay separate.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
