// Source-derived branch and short-circuit controls against the current runtime.
// Usage: node tools/half-damage-reader-boundary-gate.mjs [report.json]
import './half-damage-reader-private-loader.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const rows = [];
let timedOut=false;
function summary() {
    return {kind:'constructed JS boundary controls',passed:rows.filter(r=>r.pass).length,
        total:rows.length,controlsSHA256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
        failures:rows.filter(r=>!r.pass),timeout:timedOut};
}
function save() {
    if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(summary(),null,2)+'\n');
}
const deadline=setTimeout(()=>{
    timedOut=true;save();console.error(JSON.stringify(summary()));process.exit(2);
},55000);
{
    const load = name => import(new URL(`../js/${name}.js`, import.meta.url));
    const state = await load('gstate'), rng = await load('rng');
    const prop = await load('youprop'), potion = await load('potion');
    const {setup, seed, clearMessages, messages, x, y} = await import(new URL(
        './half-damage-intrinsic-setup.mjs', import.meta.url));
    const {regen_hp} = await load('allmain'), {mind_blast} = await load('monmove');
    const {wand_explode, drop_boulder_on_player} = await load('read');
    const {trapeffect_pit, trapeffect_rocktrap} = await load('trap');
    const {spelleffects} = await load('spell');
    const {mksobj} = await load('mkobj'), {addinv} = await load('invent');
    const {setworn} = await load('worn');
    const {ACURR} = await load('attrib');
    const {set_levltyp} = await load('mkmaze');
    const {ONAMES:O} = await load('objects_data'), {PMNAMES:PM} = await load('monst_data');
    const C = await load('const');
    let game;
    async function check(name, fn) {
        try {
            const run = await setup(); game = state.game;
            let reads = 0;
            run._display.onEmptyQueue = () => {
                assert.ok(++reads <= 20, 'bounded prompt dismissal'); return 27;
            };
            game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
            Object.assign(game.u,{uhp:1000,uhpmax:1000,mh:100,mhmax:100,ublind:0,
                uinvulnerable:false,ux0:x-3,uy0:y,umoved:true,usleep:0});
            game.moves = 1; game.iflags.menu_requested = false;
            await fn(); rows.push({name,pass:true});
        } catch(error) { rows.push({name,pass:false,error:error.message.slice(0,500)}); }
    }
    const object = type => {
        const obj = mksobj(type,false,false); obj.dknown = obj.known = true;
        game.objects[type].oc_name_known = true; return obj;
    };
    for (const type of ['physical','spell']) await check(`${type} helper truth table`, async () => {
        const h = type === 'physical' ? 'HHalf_physical_damage' : 'HHalf_spell_damage';
        const key = type === 'physical' ? 'HALF_PHDAM' : 'HALF_SPDAM';
        const predicate = type === 'physical' ? prop.Half_physical_damage : prop.Half_spell_damage;
        for (const [intrinsic,extrinsic] of [[0,0],[1,0],[C.FROMOUTSIDE,0],[0,C.W_ART],[1,C.W_ART]]) {
            game.u.intrinsic[h]=intrinsic; game.u.uprops[key]=extrinsic; seed();
            assert.equal(predicate(),!!(intrinsic || extrinsic));
            assert.deepEqual(rng.getRngLog(),[]);
        }
    });
    for (const source of ['timed','permanent','equipment']) await check(`acid hit resists ${source}`, async () => {
        if (source === 'equipment') game.u.uprops.ACID_RES = C.W_ART;
        else game.u.intrinsic.HAcid_resistance = source === 'timed' ? 50 : C.FROMOUTSIDE;
        potion.set_itimeout('HHalf_physical_damage',50);
        game.u.uprops.HALF_PHDAM=C.W_ART; // Isolate the acid-resistance guard from bottle impact.
        const obj = object(O.POT_ACID); obj.cursed = true;
        seed(4); await potion.potionhit(game.youmonst,obj,C.POTHIT_OTHER_THROW);
        assert.equal(game.u.uhp,999,'only rounded bottle impact remains');
        assert.ok(!rng.getRngLog().some(c => c.startsWith('d(2,8)')),'resistance skips acid roll');
        assert.doesNotMatch(messages(),/This burns/);
    });
    for (const setting of ['even-half','odd-half','breathing-timer','regenerating','sleepy-eel','in-water'])
        await check(`eel ${setting}`, async () => {
            game.u.umonnum = PM.PM_GIANT_EEL; game.youmonst.data = game.mons[PM.PM_GIANT_EEL];
            if (setting.endsWith('half')) potion.set_itimeout('HHalf_physical_damage',50);
            if (setting === 'even-half') game.moves=2;
            if (setting === 'breathing-timer') game.u.intrinsic.HMagical_breathing=50;
            if (setting === 'regenerating') game.u.intrinsic.HRegeneration=50;
            if (setting === 'sleepy-eel') { game.u.uprops.SLEEPY=C.W_ART; game.u.usleep=1; }
            if (setting === 'in-water') set_levltyp(x,y,C.POOL);
            const draws = ['even-half','odd-half','sleepy-eel'].includes(setting);
            seed(4);
            const loses = draws && rng.rn2(100)>rng.rn2(8) && setting !== 'odd-half';
            const expectedCalls=[...rng.getRngLog()]; seed(4); await regen_hp(0);
            assert.equal(game.u.mh,100-Number(loses));
            assert.deepEqual(rng.getRngLog(),expectedCalls,'C guard order and short circuit');
        });
    for (const source of ['intrinsic','equipment']) await check(`sleep regeneration ${source}`, async () => {
        game.u.uhp=500; game.u.usleep=1;
        if(source==='intrinsic') game.u.intrinsic.HSleepy=50; else game.u.uprops.SLEEPY=C.W_ART;
        seed(); const heal=Number(game.u.ulevel+ACURR(C.A_CON)>rng.rn2(100))+2;
        const expected=[...rng.getRngLog()]; seed(); await regen_hp(C.MOD_ENCUMBER);
        assert.equal(game.u.uhp,500+heal); assert.deepEqual(rng.getRngLog(),expected);
    });
    for (const kind of ['latent','sensed','none','peaceful','invulnerable','distant'])
        await check(`psychic ${kind}`, async () => {
            const mon={mx:x+1,my:y,mnum:PM.PM_MIND_FLAYER,data:game.mons[PM.PM_MIND_FLAYER],
                mhp:100,mpeaceful:kind==='peaceful'};
            if(kind==='distant') mon.mx=x+15;
            if(kind==='invulnerable') game.u.uinvulnerable=true;
            if(kind==='latent'||kind==='sensed') game.u.intrinsic.HTelepat=C.FROMOUTSIDE;
            if(kind==='sensed') game.u.intrinsic.HBlinded=50;
            game.u.intrinsic.HHalf_spell_damage=50;
            seed(4); let damage=0;
            if(['latent','sensed','none'].includes(kind)) {
                if(kind==='sensed' || (kind==='latent' && rng.rn2(2)) || !rng.rn2(10))
                    damage=Math.ceil(rng.rnd(15)/2);
            }
            const expected=[...rng.getRngLog()]; seed(4); await mind_blast(mon);
            assert.deepEqual(rng.getRngLog(),expected); assert.equal(game.u.uhp,1000-damage);
        });
    for (const [kind,k] of [['WAN_WISHING',12],['WAN_DEATH',10],['WAN_FIRE',8],['WAN_NOTHING',4],['WAN_LIGHT',6]])
        await check(`wand minimum ${kind}`,async()=>{
            const obj=object(O[kind]); obj.spe=-1; await addinv(obj);
            game.u.intrinsic.HHalf_physical_damage=50;
            seed(); const expected=Math.ceil(rng.d(2,k)/2); seed(); await wand_explode(obj,0);
            assert.equal(game.u.uhp,1000-expected); assert.ok(!game.invent.includes(obj));
        });
    for(const kind of ['blocked','uncursed']) await check(`levitation ${kind}`,async()=>{
        const obj=object(O.POT_LEVITATION); obj.cursed=kind==='blocked';
        if(obj.cursed) game.u.blocked.LEVITATION=1;
        seed(); await potion.peffect_levitation(obj); assert.equal(game.u.uhp,1000);
        assert.ok(!rng.getRngLog().some(c=>c.startsWith('rnd(10)')));
    });
    for(const kind of ['helmet','passes-walls']) await check(`earth ${kind}`,async()=>{
        if(kind==='helmet') {
            const obj=object(O.HELMET); await addinv(obj); setworn(obj,C.W_ARMH);
        }
        else game.u.intrinsic.HPasses_walls=50;
        game.u.intrinsic.HHalf_physical_damage=50;
        seed(4); await drop_boulder_on_player(false,true,true,false);
        assert.equal(game.u.uhp,kind==='helmet'?999:1000);
    });
    for(const kind of ['levitating','flying','careful']) await check(`pit ${kind}`,async()=>{
        if(kind==='levitating') game.u.intrinsic.HLevitation=50;
        if(kind==='flying') game.u.intrinsic.HFlying=50;
        if(kind==='careful') game.iflags.menu_requested=true;
        const t={tx:x,ty:y,ttyp:C.PIT,tseen:1,once:0,madeby_u:0};
        game.level.traps.push(t); game.u.intrinsic.HHalf_physical_damage=50;
        seed(); await trapeffect_pit(game.youmonst,t,0); assert.equal(game.u.uhp,1000);
        if(kind!=='careful') assert.deepEqual(rng.getRngLog(),[]);
    });
    await check('rock passes through unhelmeted xorn',async()=>{
        game.u.umonnum=PM.PM_XORN; game.youmonst.data=game.mons[PM.PM_XORN];
        const t={tx:x,ty:y,ttyp:C.ROCKTRAP,tseen:0,once:0,madeby_u:0};
        game.level.traps.push(t); seed(); await trapeffect_rocktrap(game.youmonst,t,0);
        assert.equal(game.u.mh,100); assert.match(messages(),/harmlessly through/);
    });
    await check('force bolt antimagic short circuit',async()=>{
        game.u.intrinsic.HAntimagic=50; game.u.intrinsic.HHalf_physical_damage=50;
        seed(); await spelleffects(O.SPE_FORCE_BOLT,true,true);
        assert.equal(game.u.uhp,1000); assert.match(messages(),/Boing/);
        assert.ok(!rng.getRngLog().some(c=>c.startsWith('d(2,12)')));
    });
}
assert.equal(rows.length,33,'all sealed boundary controls ran');
save(); clearTimeout(deadline);
console.log(JSON.stringify(summary()));
if(rows.some(r=>!r.pass)) process.exitCode=1;
