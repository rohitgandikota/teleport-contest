#!/usr/bin/env node

// C uhitm.c:2859..2962. Constructed boundary checks do not earn C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {initRng,rn2,getRngLog} from '../js/rng.js';
import {mhitm_ad_tlpt} from '../js/uhitm.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {magic_negation} from '../js/mhitu.js';
import {Half_physical_damage} from '../js/youprop.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';
import {ONAMES as N} from '../js/objects_data.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {Upolyd,NO_MINVENT,MM_NOMSG,W_ARMC,OBJ_MINVENT,STRAT_WAITFORU} from '../js/const.js';
const read=kind=>JSON.parse(fs.readFileSync(new URL(`gen-sessions/${kind}/quantum-teleport-attacks${kind==='generated'?'.session':''}.json`,import.meta.url)));
const recipe=read('recipes'),oracle=read('generated');
let replays=0;
for(const [i,s]of recipe.segments.entries()) {
    let targetBefore;
    if(s.name.startsWith('poly-')) {
        await runSegment({...s,moves:s.moves.slice(0,s.moves.lastIndexOf('F')),storage:new InMemoryStorage()});
        const type=s.name.includes('lichen')?P.PM_LICHEN:P.PM_HILL_GIANT;
        const m=game.level.monsters.find(m=>m.mnum===type&&m.mhp>0);
        assert.ok(m,s.name);targetBefore={type,hp:m.mhp,x:m.mx,y:m.my};
    }
    const replay=await runSegment({...s,storage:new InMemoryStorage()});
    const rng=oracle.segments[i].steps.flatMap(t=>t.rng||[]);
    assert.equal(replay.getRngLog().length,rng.length,s.name+': C RNG total');
    assert.equal(game.u.umortality||0,0,s.name+': no setup death');
    const rows=decodeScreen(oracle.segments[i].steps.at(-1).screen);
    const hp=/HP:(\d+)\((\d+)\)/.exec(rows.join('\n'));assert.ok(hp,s.name);
    assert.equal(Upolyd(game.u)?game.u.mh:game.u.uhp,Number(hp[1]),s.name+': C final HP');
    if(targetBefore) {
        const m=game.level.monsters.find(m=>m.mnum===targetBefore.type&&m.mhp>0);
        const roll=rng.find(r=>r.includes('@ damageum(uhitm.c:4842)'));assert.ok(roll,s.name);
        const damage=Number(/=(\d+)/.exec(roll)[1]);assert.ok(m,s.name+': target survives');
        assert.equal(m.mhp,Math.max(1,targetBefore.hp-damage),s.name+': nonfatal C damage');
        assert.ok(m.mx!==targetBefore.x||m.my!==targetBefore.y,s.name+': target relocates');
    }
    if(s.name.startsWith('cancel-')) {
        const q=game.level.monsters.find(m=>m.mnum===P.PM_QUANTUM_MECHANIC&&m.mhp>0);
        assert.ok(q?.mcan,s.name+': attacker cancelled');
    }
    if(s.name.includes('magic-negation'))assert.equal(magic_negation(null),3,s.name);
    if(s.name.includes('half-damage'))assert.ok(Half_physical_damage(),s.name);
    replays++;
}
assert.equal(replays,20);
console.log(`teleport attacks: ${replays} native replays, HP, cancellation, protection and relocation`);

let checks=0;
const attack=[A.AT_CLAW,A.AD_TLPT,1,4];
async function setup() {
    const s=recipe.segments[0];resetInputState();
    await runSegment({...s,moves:s.moves.slice(0,s.moves.indexOf('\x07')),storage:new InMemoryStorage()});
    game._preNhgetchHook=null;game._toplin=0;game._win_stop=false;
    game.flags.verbose=false;game.iflags.mon_telecontrol=false;game.context.mon_moving=false;
    const q=makemon(game.mons[P.PM_QUANTUM_MECHANIC],0,0,NO_MINVENT|MM_NOMSG);
    const target=makemon(game.mons[P.PM_HILL_GIANT],0,0,NO_MINVENT|MM_NOMSG);
    assert.ok(q&&target);game.vis=false;
    resetInputState();pushKeys('\x1b'.repeat(30)+' '.repeat(30));
    initRng(1);checks++;return {q,target};
}
const mhm=damage=>({damage,hitflags:0,permdmg:0,specialdmg:0,done:false});
for(const [poly,half,hp,damage,wantDamage,wantHp]of [
    [false,false,10,4,4,10], [false,false,3,4,2,3], [false,false,1,4,1,2],
    [true,false,3,4,2,3], [true,false,1,4,1,2],
    [false,true,2,6,2,2], [false,true,1,4,1,2], [true,true,1,4,1,2],
    [false,true,2,4,4,2]
]) {
    const {q}=await setup();game.u.mtimedone=poly?20:0;
    game.u.uhp=poly?100:hp;game.u.mh=poly?hp:100;
    game.u.intrinsic.HHalf_physical_damage=half?1:0;
    const hit=mhm(damage);await mhitm_ad_tlpt(q,attack,game.youmonst,hit);
    assert.equal(hit.damage,wantDamage,`poly=${poly} half=${half} hp=${hp} damage=${damage}`);
    assert.equal(poly?game.u.mh:game.u.uhp,wantHp,'HP safety increment');
    assert.equal(poly?game.u.uhp:game.u.mh,100,'other HP pool unchanged');
    assert.ok(getRngLog()[0].startsWith('rn2(10)='),'cancellation draw precedes teleport');
}
for(const kind of ['cancelled','lethal','restricted']) {
    const {q,target}=await setup(),hit=mhm(4);target.mstrategy=STRAT_WAITFORU;
    const pos=[target.mx,target.my];
    if(kind==='cancelled')q.mcan=1;
    if(kind==='lethal')target.mhp=4;
    if(kind==='restricted')game.level.flags.noteleport=true;
    await mhitm_ad_tlpt(q,attack,target,hit);
    assert.equal(getRngLog().length,0,kind+': no cancellation or relocation draw');
    assert.deepEqual([target.mx,target.my],pos,kind);assert.equal(hit.damage,4,kind);
    assert.equal(target.mstrategy,STRAT_WAITFORU,kind+': strategy preserved');
}
{
    const {q}=await setup();q.mcan=1;game.u.uhp=1;const hit=mhm(4);
    await mhitm_ad_tlpt(q,attack,game.youmonst,hit);
    assert.equal(getRngLog().length,0);assert.equal(hit.damage,4);assert.equal(game.u.uhp,1);
}
const negatedSeed=(()=>{for(let i=1;;i++){initRng(i);if(rn2(10)<9)return i;}})();
for(const hero of [true,false]) {
    const {q,target}=await setup(),hit=mhm(4);
    const cloak=mksobj(N.CLOAK_OF_PROTECTION,false,false);
    cloak.owornmask=W_ARMC;cloak.where=OBJ_MINVENT;cloak.ocarry=target;target.minvent=[cloak];
    assert.equal(magic_negation(target),3);const pos=[target.mx,target.my];
    initRng(negatedSeed);await mhitm_ad_tlpt(hero?game.youmonst:q,attack,target,hit);
    assert.equal(getRngLog().length,1);assert.equal(hit.damage,4);
    assert.deepEqual([target.mx,target.my],pos,'negated attack leaves target in place');
}
for(const [hp,damage,wantHp,wantDamage]of [[10,0,10,1],[3,4,3,2],[1,4,2,1]]) {
    const {target}=await setup();target.mhp=hp;const hit=mhm(damage);
    await mhitm_ad_tlpt(game.youmonst,attack,target,hit);
    assert.equal(target.mhp,wantHp);assert.equal(hit.damage,wantDamage);
}
{
    const {q,target}=await setup();target.mstrategy=STRAT_WAITFORU;const hit=mhm(1);
    const pos=[target.mx,target.my];await mhitm_ad_tlpt(q,attack,target,hit);
    assert.equal(target.mstrategy&STRAT_WAITFORU,0);assert.equal(hit.damage,1);
    assert.notDeepEqual([target.mx,target.my],pos);assert.ok(getRngLog().length>1);
}
console.log(`teleport attacks: ${checks} constructed C boundary groups`);
