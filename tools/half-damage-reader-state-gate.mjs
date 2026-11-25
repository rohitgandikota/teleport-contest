// Constructed source controls against the current repository runtime.
// Usage: node tools/half-damage-reader-state-gate.mjs [report.json]
import './half-damage-reader-private-loader.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const report = {kind:'constructed JS, source-derived', controls:[], firstFailures:[]};
function summary() {
    return {kind:report.kind, passed:report.controls.filter(r=>r.pass).length,
        total:report.controls.length,
        controlsSHA256:createHash('sha256').update(JSON.stringify(report.controls)).digest('hex'),
        firstFailures:report.firstFailures, timeout:report.timeout};
}
function save() {
    if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(summary(),null,2)+'\n');
}
const deadline = setTimeout(() => {
    report.timeout = '55 second worker limit'; save();
    console.error(JSON.stringify(summary())); process.exit(2);
}, 55000);
const modes = ['none', 'timed', 'permanent', 'equipment', 'both', 'expired', 'wrong'];
const samples = ['bottle', 'acid-hit', 'acid-drink', 'ceiling', 'wand', 'ring',
    'earth', 'force-bolt', 'rocktrap', 'spiked-pit', 'pit', 'lava', 'eel', 'psychic'];
{
    const module = name => import(new URL(`../js/${name}.js`, import.meta.url));
    const {setup, seed, clearMessages, messages, x, y} = await import(new URL(
        './half-damage-intrinsic-setup.mjs', import.meta.url));
    const state = await module('gstate');
    let game;
    const {mksobj} = await module('mkobj');
    const {addinv} = await module('invent');
    const potion = await module('potion'), read = await module('read');
    const trap = await module('trap'), {spelleffects} = await module('spell');
    const {regen_hp} = await module('allmain'), {mind_blast} = await module('monmove');
    const {boulder_hits_pool} = await module('do');
    const {set_levltyp} = await module('mkmaze');
    const {getRngLog} = await module('rng');
    const {ONAMES:O} = await module('objects_data');
    const {PMNAMES:PM} = await module('monst_data');
    const C = await module('const');
    for (const name of samples) for (const rngSeed of [2, 3, 4, 5]) {
        const paired = {};
        for (const mode of modes) {
            const id = `${name}/${rngSeed}/${mode}`;
            try {
                const run = await setup();
                game = state.game; // resetGame replaces the exported object at each startup.
                // Escape dismisses optional naming and More prompts; never invent input forever.
                let prompts = 0;
                run._display.onEmptyQueue = () => {
                    assert.ok(++prompts <= 20, 'bounded prompt dismissal'); return 27;
                };
                game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
                Object.assign(game.u, {uhp:1000, uhpmax:1000, mh:100, mhmax:100,
                    ux0:x-3, uy0:y, uinvulnerable:false, ublind:0, usleep:0});
                game.moves = 1; game.iflags.menu_requested = false;
                const spell = name === 'psychic';
                const key = spell ? 'HALF_SPDAM' : 'HALF_PHDAM';
                const h = spell ? 'HHalf_spell_damage' : 'HHalf_physical_damage';
                if (mode === 'timed' || mode === 'both') potion.set_itimeout(h, 50);
                if (mode === 'permanent') game.u.intrinsic[h] = C.FROMOUTSIDE;
                if (mode === 'equipment' || mode === 'both') game.u.uprops[key] = C.W_ART;
                if (mode === 'expired') { potion.set_itimeout(h, 1); potion.set_itimeout(h, 0); }
                if (mode === 'wrong') {
                    game.u.intrinsic[spell ? 'HHalf_physical_damage' : 'HHalf_spell_damage'] = 50;
                }
                const object = type => {
                    const obj = mksobj(type, false, false);
                    obj.dknown = obj.known = true;
                    game.objects[type].oc_name_known = true;
                    return obj;
                };
                let action;
                if (name === 'bottle' || name === 'acid-hit') {
                    const obj = object(name === 'bottle' ? O.POT_WATER : O.POT_ACID);
                    action = () => potion.potionhit(game.youmonst, obj, C.POTHIT_OTHER_THROW);
                } else if (name === 'acid-drink') {
                    action = () => potion.peffect_acid(object(O.POT_ACID));
                } else if (name === 'ceiling') {
                    const obj = object(O.POT_LEVITATION); obj.cursed = true;
                    action = () => potion.peffect_levitation(obj);
                } else if (name === 'wand' || name === 'ring') {
                    const obj = object(name === 'wand' ? O.WAN_NOTHING : O.RIN_PROTECTION);
                    obj.spe = name === 'wand' ? 2 : 7; await addinv(obj);
                    action = () => name === 'wand' ? read.wand_explode(obj, 0) : read.recharge(obj, 0);
                } else if (name === 'earth') {
                    action = () => read.drop_boulder_on_player(false, true, true, false);
                } else if (name === 'force-bolt') {
                    action = () => spelleffects(O.SPE_FORCE_BOLT, true, true);
                } else if (name === 'rocktrap' || name === 'pit' || name === 'spiked-pit') {
                    const t = {tx:x, ty:y, ttyp:name === 'rocktrap' ? C.ROCKTRAP
                        : name === 'pit' ? C.PIT : C.SPIKED_PIT, once:0, tseen:0, madeby_u:0};
                    game.level.traps.push(t);
                    // Isolate spike impact from the separately owned poison damage.
                    game.u.intrinsic.HPoison_resistance = C.FROMOUTSIDE;
                    action = () => name === 'rocktrap'
                        ? trap.trapeffect_rocktrap(game.youmonst, t, 0)
                        : trap.trapeffect_pit(game.youmonst, t, 0);
                } else if (name === 'lava') {
                    set_levltyp(x+1, y, C.LAVAPOOL);
                    const obj = object(O.BOULDER);
                    action = () => boulder_hits_pool(obj, x+1, y, false);
                } else if (name === 'eel') {
                    game.u.umonnum = PM.PM_GIANT_EEL;
                    game.youmonst.data = game.mons[PM.PM_GIANT_EEL];
                    action = () => regen_hp(0);
                } else if (name === 'psychic') {
                    game.u.intrinsic.HBlinded = 20;
                    game.u.intrinsic.HTelepat = C.FROMOUTSIDE;
                    const mon = {mx:x+1, my:y, mnum:PM.PM_MIND_FLAYER,
                        data:game.mons[PM.PM_MIND_FLAYER], mhp:100, mpeaceful:false};
                    action = () => mind_blast(mon);
                }
                clearMessages(); seed(rngSeed);
                await action();
                const row = {damage:name === 'eel' ? 100-game.u.mh : 1000-game.u.uhp,
                    calls:[...getRngLog()], messages:messages()};
                paired[mode] = row;
                if (mode === 'none') {
                    assert.ok(row.damage > 0, `${name} branch reached`);
                } else {
                    assert.deepEqual(row.calls, paired.none.calls, 'property changes no random calls');
                    const protectedMode = ['timed','permanent','equipment','both'].includes(mode);
                    let expected = paired.none.damage;
                    if (protectedMode) {
                        if (name === 'eel') expected = 0; // Odd turn, after both random draws.
                        else if (name === 'acid-hit') {
                            const impact = Number(row.calls.find(c => c.startsWith('rnd(2)=')).split('=')[1]);
                            expected = Math.ceil(impact/2) + Math.ceil((paired.none.damage-impact)/2);
                        } else expected = Math.ceil(expected/2);
                    }
                    assert.equal(row.damage, expected, 'C half damage / separate impact rounding');
                }
                report.controls.push({id,pass:true,damage:row.damage});
            } catch (error) {
                const failure = {id,pass:false,error:error.message.slice(0,500)};
                report.controls.push(failure);
                if (!report.firstFailures.some(f => f.owner === name))
                    report.firstFailures.push({...failure,owner:name});
            }
        }
    }
}
assert.equal(report.controls.length,392,'all sealed state controls ran');
save(); clearTimeout(deadline);
console.log(JSON.stringify(summary()));
if(report.controls.some(r=>!r.pass)) process.exitCode=1;
