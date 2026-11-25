// Current repository gate. Usage: node tools/monster-death-owner-state-gate.mjs [report.json]
// Constructed controls. All monsters, forms, equipment and lethal damage use
// production APIs. Direct condition assignments are identified at each case.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const mod = name => import(new URL(`../js/${name}.js`, import.meta.url));
const {runSegment} = await mod('jsmain');
const {InMemoryStorage} = await mod('storage');
const state = await mod('gstate');
const mon = await mod('mon');
const {makemon, mongets} = await mod('makemon');
const {resist,revive} = await mod('zap');
const {tamedog} = await mod('dog');
const {m_dowear,mon_set_minvis} = await mod('worn');
const {set_levltyp} = await mod('mkmaze');
const {vision_recalc, recalc_block_point} = await mod('vision');
const {display_nhwindow_message, newsym, pline,map_invisible,glyph_is_invisible_at} = await mod('display');
const {gulpmu} = await mod('mhitu');
const {stock_room} = await mod('shknam');
const {mkcorpstat} = await mod('mkobj');
const {stairway_add,maketrap} = await mod('mklev');
const {resetInputState} = await mod('input');
const {getRngLog,initRng,enableRngLog} = await mod('rng');
const {PMNAMES: P, ATTKS: A} = await mod('monst_data');
const {ONAMES: O, OCLASSES: OC} = await mod('objects_data');
const C = await mod('const');
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const rc = 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
    + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
let run, reads, start, notes, messages;
const g = () => state.game;
function feed() {
    reads = 0; messages = [];
    run._display.onEmptyQueue = async () => {
        await setImmediate();
        messages.push(g()._pending_message || g()._toplines);
        assert.ok(++reads <= 100, 'bounded physical input');
        return 32;
    };
}
async function boot(seed = 12001) {
    run = await runSegment({seed, moves:' ', datetime:'20000112093000',
        nethackrc:rc, storage:new InMemoryStorage()});
    resetInputState(); feed(); await display_nhwindow_message(); feed();
    notes = {};
    start = getRngLog().length;
}
function text() {
    return [...messages, ...(g()._msg_history || []), g()._toplines,
        g()._pending_message].join('\n');
}
function square() {
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]]) {
        const x=g().u.ux+dx,y=g().u.uy+dy;
        if (g().level.at(x,y)?.typ===C.ROOM && !mon.m_at(x,y)) return [x,y];
    }
    assert.fail('requires a real vacant adjacent room cell');
}
async function make(mnum) {
    const m = await makemon(g().mons[mnum], ...square(), C.NO_MM_FLAGS);
    assert.ok(m); await newsym(m.mx,m.my); return m;
}
async function shifted(base, form) {
    const m=await make(base);
    await mon.newcham(m,g().mons[form],C.NO_NC_FLAGS);
    assert.equal(m.mnum,form); assert.equal(m.cham,base);
    return m;
}
async function kill(m) {
    // Actual resistance, damage, killed/xkilled, then mondead.
    await resist(m,OC.WAND_CLASS,2000,false);
}
const count = n => g().mvitals[n].died;
function alive(m) {
    assert.ok(m.mhp>0); assert.equal(mon.m_at(m.mx,m.my),m);
    assert.ok(g().level.monsters.includes(m));
    assert.equal((m.mstate||0)&C.MON_DETACH,0);
}
function detached(m) {
    assert.equal(m.mhp,0); assert.notEqual(mon.m_at(m.mx,m.my),m);
    assert.ok(g().level.monsters.includes(m),'C keeps detached monster until dmonsfree');
    assert.ok(m.mstate&C.MON_DETACH);
    mon.dmonsfree(); assert.ok(!g().level.monsters.includes(m));
    assert.equal(g().iflags.purge_monsters,0);
}
const tests=[];
function check(name,fn) { tests.push([name,fn]); }
for (const form of ['PM_VAMPIRE_BAT','PM_FOG_CLOUD','PM_WOLF']) {
    check(`vampire/${form}`,async()=>{
        const m=await shifted(P.PM_VAMPIRE, P[form]);
        const id=m.m_id; await kill(m);
        alive(m); assert.equal(m.m_id,id); assert.equal(m.mnum,P.PM_VAMPIRE);
        assert.equal(m.cham,C.NON_PM); assert.equal(count(P.PM_VAMPIRE),0);
        assert.ok(g().vamp_rise_msg); assert.match(text(),/rises as a vampire!/);
        notes={form:m.mnum,hp:m.mhp,deathCount:count(P.PM_VAMPIRE)};
    });
}
check('vampire/base-form-dies',async()=>{
    const m=await make(P.PM_VAMPIRE); await mon.newcham(m,g().mons[P.PM_VAMPIRE],0);
    await kill(m); assert.equal(count(P.PM_VAMPIRE),1); detached(m);
});
check('vampire/lifesaving-precedes-return',async()=>{
    const m=await make(P.PM_VAMPIRE);
    await mon.newcham(m,g().mons[P.PM_VAMPIRE],0);
    mongets(m,O.AMULET_OF_LIFE_SAVING); await m_dowear(m,true);
    assert.ok(mon.mlifesaver(m));
    await mon.newcham(m,g().mons[P.PM_VAMPIRE_BAT],0);
    assert.ok(mon.mlifesaver(m));
    await kill(m); alive(m); assert.equal(m.mnum,P.PM_VAMPIRE_BAT);
    assert.ok(!mon.mlifesaver(m)); assert.equal(count(P.PM_VAMPIRE),0);
    await kill(m); alive(m); assert.equal(m.mnum,P.PM_VAMPIRE);
});
check('vampire/pet-sad-flag-consumed',async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_VAMPIRE_BAT);
    assert.ok(await tamedog(m,null,false));
    await mon.monkilled(m,null,A.AD_DGST);
    alive(m); assert.equal(g().iflags.sad_feeling,false);
    assert.doesNotMatch(text(),/sad feeling/); assert.match(text(),/reconstitutes/);
});
check('vampire/genocided-base',async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_VAMPIRE_BAT);
    // Constructed genocide condition, no replacement of the genocide helper.
    g().mvitals[P.PM_VAMPIRE].mvflags|=C.G_GENOD;
    await kill(m); assert.equal(count(P.PM_VAMPIRE),1); detached(m);
});
check('vampire/release-grip-before-return',async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_VAMPIRE_BAT);
    mon.set_ustuck(m); await kill(m); alive(m);
    assert.equal(g().u.ustuck,null);
    assert.ok(text().indexOf('no longer in your clutches') < text().indexOf('rises as'));
});
for (const trapped of [false,true]) check(`vampire/closed-door-${trapped}`,async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_FOG_CLOUD);
    assert.ok(set_levltyp(m.mx,m.my,C.DOOR));
    // Constructed door flags on terrain created by set_levltyp.
    g().level.at(m.mx,m.my).doormask=C.D_CLOSED|(trapped?C.D_TRAPPED:0);
    recalc_block_point(m.mx,m.my); vision_recalc();
    const verbose=g().flags.verbose, before=getRngLog().length;
    await kill(m); alive(m);
    assert.equal(g().level.at(m.mx,m.my).doormask,C.D_NODOOR);
    assert.equal(g().flags.verbose,verbose);
    assert.equal(getRngLog().slice(before).some(s=>s.startsWith('rnd(15)=')),trapped);
    assert.doesNotMatch(text(),/KABOOM/);
    if(trapped) assert.equal(m.mstun,1);
});
check('steam/death-produces-harmless-cloud',async()=>{
    const m=await make(P.PM_STEAM_VORTEX),before=(g().regions||[]).length;
    const draw=getRngLog().length,xy=[m.mx,m.my];
    await kill(m);
    assert.equal(g().regions.length,before+1);
    const cloud=g().regions.at(-1),calls=getRngLog().slice(draw);
    assert.equal(cloud.arg,0); assert.equal(cloud.damaging,false);
    assert.ok(cloud.ttl>=4); assert.ok(cloud.rects.some(r=>r.lx===xy[0]&&r.ly===xy[1]));
    assert.ok(calls.some(s=>s.startsWith('rn2(10)=')));
    assert.equal(count(P.PM_STEAM_VORTEX),1); detached(m);
    notes={cells:cloud.rects.length,ttl:cloud.ttl,damage:cloud.arg};
});
check('steam/fog-negative',async()=>{
    const m=await make(P.PM_FOG_CLOUD),before=(g().regions||[]).length;
    await kill(m); assert.equal((g().regions||[]).length,before);
    assert.equal(count(P.PM_FOG_CLOUD),1); detached(m);
});
check('steam/shape-restoration-follows-cloud',async()=>{
    const m=await shifted(P.PM_CHAMELEON,P.PM_STEAM_VORTEX);
    const before=(g().regions||[]).length;
    await kill(m); assert.equal(g().regions.length,before+1);
    assert.equal(count(P.PM_CHAMELEON),1); assert.equal(count(P.PM_STEAM_VORTEX),0);
    detached(m);
});
check('steam/vampire-return-precedes-cloud',async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_STEAM_VORTEX);
    const before=(g().regions||[]).length;
    await kill(m); alive(m); assert.equal(m.mnum,P.PM_VAMPIRE);
    assert.equal((g().regions||[]).length,before);
});
check('leader/identity-survives-polymorph',async()=>{
    const m=await make(g().urole.ldrnum);
    assert.equal(g().quest_status.leader_m_id,m.m_id);
    await mon.newcham(m,g().mons[P.PM_DOG],0);
    assert.equal(m.mnum,P.PM_DOG);
    await mon.mondead(m); assert.equal(g().quest_status.leader_is_dead,true);
    detached(m);
});
check('mail/death-prevents-delivery',async()=>{
    const m=await make(P.PM_MAIL_DAEMON); await mon.mondead(m);
    assert.ok(g().mvitals[P.PM_MAIL_DAEMON].mvflags&C.G_GENOD); detached(m);
});
check('log/medusa-first-achievement',async()=>{
    const m=await make(P.PM_MEDUSA); await kill(m);
    assert.ok(g().u.uachieved.includes(C.ACH_MEDU));
    assert.ok(g().gamelog.some(e=>/Medusa/.test(e.text))); detached(m);
});
check('log/unique-thresholds-and-saturation',async()=>{
    // Constructed count boundaries; identities still come from makemon.
    for(const old of [0,1,2,3,4,9,24,49,254,255]) {
        g().mvitals[P.PM_ORCUS].died=old;
        const m=await make(P.PM_ORCUS),before=(g().gamelog||[]).length;
        await mon.mondead(m);
        const n=Math.min(old+1,255),emit=n<=3||[5,10,25,50].includes(n);
        assert.equal(count(P.PM_ORCUS),n);
        assert.equal((g().gamelog||[]).length-before,emit?1:0);
        if(emit) {
            const event=g().gamelog.at(-1);
            assert.match(event.text,/killed Orcus/);
            assert.equal(event.flags,C.LL_UMONST|(n===1?C.LL_ACHIEVE:0));
        }
        detached(m);
    }
});
check('log/monster-caused-unique-death',async()=>{
    const m=await make(P.PM_ORCUS);
    g().context.mon_moving=true; // Constructed caller context.
    await mon.monkilled(m,null,A.AD_DGST);
    assert.equal(g().gamelog.at(-1).text,'Orcus has been killed'); detached(m);
});
check('inventory/deferred-unlink',async()=>{
    const m=await make(P.PM_GOBLIN);
    mongets(m,O.DIAMOND); const gem=m.minvent.find(o=>o.otyp===O.DIAMOND);
    assert.ok(gem); const xy=[m.mx,m.my];
    await kill(m); assert.ok(g().level.objectsAt(...xy).includes(gem));
    assert.ok(!m.minvent.length); detached(m);
});
check('map/death-clears-invisible-memory',async()=>{
    const m=await make(P.PM_GOBLIN);
    mon_set_minvis(m,false);map_invisible(m.mx,m.my);
    assert.ok(glyph_is_invisible_at(m.mx,m.my));
    await mon.mondead(m);assert.ok(!glyph_is_invisible_at(m.mx,m.my));detached(m);
});
check('vampire/real-engulf-release',async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_FOG_CLOUD);
    await gulpmu(m,m.data.mattk.find(a=>a[0]===A.AT_ENGL));
    assert.equal(g().u.ustuck,m); assert.ok(g().u.uswallow);
    await kill(m); alive(m); assert.equal(m.mnum,P.PM_VAMPIRE);
    assert.equal(g().u.ustuck,null); assert.ok(!g().u.uswallow);
});
check('vampire/revival-message-suspends-before-door',async()=>{
    const m=await shifted(P.PM_VAMPIRE,P.PM_FOG_CLOUD);
    assert.ok(set_levltyp(m.mx,m.my,C.DOOR));
    const door=g().level.at(m.mx,m.my); door.doormask=C.D_CLOSED|C.D_TRAPPED;
    recalc_block_point(m.mx,m.my); vision_recalc();
    await display_nhwindow_message();
    await pline('An earlier long message fills the top line while the vampire waits for its next action.');
    let release,entered=false,done=false;
    const hold=new Promise(resolve=>release=resolve);
    run._display.onEmptyQueue=async()=>{entered=true;await hold;return 32;};
    const pending=mon.mondead(m).then(()=>done=true);
    await setImmediate();
    try {
        assert.ok(entered); assert.equal(done,false);
        assert.equal(m.mnum,P.PM_VAMPIRE); assert.ok(m.mhp>0);
        assert.equal(door.doormask,C.D_CLOSED|C.D_TRAPPED);
        assert.equal(count(P.PM_VAMPIRE),0);
        const rng=[...getRngLog()]; await setImmediate(); assert.deepEqual(getRngLog(),rng);
    } finally {release();await pending;feed();}
    assert.equal(door.doormask,C.D_NODOOR);
});
for(const moving of [false,true]) check(`log/real-shop-${moving}`,async()=>{
    const room=g().level.rooms.find(r=>r.doorct>0);
    assert.ok(room); room.rtype=C.SHOPBASE;
    await stock_room(0,room);
    const m=room.resident; assert.ok(m?.isshk); assert.ok(C.ESHK(m));
    g().context.mon_moving=moving;
    const before=(g().gamelog||[]).length;
    await mon.mondead(m);
    const event=g().gamelog.at(-1);
    assert.equal(g().gamelog.length,before+1);
    assert.equal(event.flags,C.LL_UMONST|C.LL_ACHIEVE);
    assert.match(event.text,moving ? /, the .* propriet(?:or|rix), has been killed$/
        : /^killed .*, the .* propriet(?:or|rix)$/);
    detached(m);
});
check('log/high-cleric-constructed-corpse-real-revival',async()=>{
    const m=await make(P.PM_HIGH_CLERIC),before=(g().gamelog||[]).length;
    await mon.mondied(m); assert.equal(g().gamelog.length,before+1);
    // High clerics do not naturally leave a corpse. Construct one through
    // the real corpse/traits producer; revive must set mrevived itself.
    const body=mkcorpstat(O.CORPSE,m,m.data,m.mx,m.my,C.CORPSTAT_INIT);
    assert.ok(body); detached(m);
    const again=await revive(body,true); assert.ok(again); assert.ok(again.mrevived);
    await mon.mondead(again); assert.equal(g().gamelog.length,before+1); detached(again);
});
for(const type of ['PM_DEATH','PM_WIZARD_OF_YENDOR']) check(`log/repeated-achievement-${type}`,async()=>{
    g().mvitals[P[type]].died=4; // Constructed fifth-kill count boundary.
    const m=await make(P[type]),before=(g().gamelog||[]).length;
    await mon.mondead(m);
    assert.equal(g().gamelog.length,before+1);
    assert.equal(g().gamelog.at(-1).flags,C.LL_UMONST|C.LL_ACHIEVE);
    assert.match(g().gamelog.at(-1).text,/\(5th time\)$/); detached(m);
});
check('detach/statue-template-awaits-cleanup',async()=>{
    const [x,y]=square(); const before=g().iflags.purge_monsters||0;
    await maketrap(x,y,C.STATUE_TRAP);
    const statue=g().level.objectsAt(x,y).find(o=>o.otyp===O.STATUE);
    assert.ok(statue);
    const dead=g().level.monsters.filter(m=>m.mhp<=0&&!m.isgd);
    assert.ok(dead.length>0); assert.ok(dead.every(m=>m.mstate&C.MON_DETACH));
    assert.equal(g().iflags.purge_monsters,before+1); mon.dmonsfree();
});
check('kop/stair-type-direction',async()=>{
    const stairs=await mod('stairs');
    // Real list producer, with explicit destination inputs.
    const to={dnum:0,dlevel:2};
    stairway_add(10,5,false,false,to);
    stairway_add(11,5,false,true,to);
    stairway_add(12,5,true,false,to);
    assert.equal(stairs.stairway_find_type_dir(false,false).sx,10);
    assert.equal(stairs.stairway_find_type_dir(true,false).sx,11);
    assert.equal(stairs.stairway_find_type_dir(false,true).sx,12);
    assert.ok(!stairs.stairway_find_type_dir(true,true));
});
check('kop/real-replacement-rolls',async()=>{
    const seen=new Set();
    for(let seed=1;seed<=16;seed++) {
        await boot();
        const m=await make(P.PM_KEYSTONE_KOP);
        const before=g().level.monsters.filter(m=>m.mnum===P.PM_KEYSTONE_KOP&&m.mhp>0).length;
        // Actual ISAAC seed, never a substituted random function or return value.
        initRng(seed);enableRngLog();
        await mon.mondead(m);
        const calls=getRngLog();
        const roll=Number(calls[0]?.split('=')[1]);
        assert.match(calls[0],/^rnd\(5\)=/);
        seen.add(roll<=2?roll:3);
        const after=g().level.monsters.filter(m=>m.mnum===P.PM_KEYSTONE_KOP&&m.mhp>0).length;
        assert.equal(after,before-1+Number(roll<=2));
        assert.equal(count(P.PM_KEYSTONE_KOP),1);detached(m);
    }
    assert.deepEqual([...seen].sort(),[1,2,3]);notes={replacementArms:[...seen].sort()};
});
const deadline=setTimeout(()=>{console.error('55 second source worker limit');process.exit(2);},55000);
const results=[];
for(const [name,fn] of tests) {
    try {
        await boot(); await fn();
        results.push({name,pass:true,notes,calls:getRngLog().length-start,
            rngSHA256:hash(getRngLog().slice(start))});
    } catch(error) {
        results.push({name,pass:false,error:error.message.slice(0,350),
            location:error.stack?.split('\n').slice(1,3).join('\n')});
    }
}
clearTimeout(deadline);
assert.equal(results.length,31,'all sealed source groups are retained');
const report={kind:'constructed state controls with production producers',
    passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,
    failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total) process.exitCode=1;
