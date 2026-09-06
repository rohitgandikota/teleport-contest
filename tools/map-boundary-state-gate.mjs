#!/usr/bin/env node
// Execute the pinned C bodies for map bounds and boundary wall flags.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {InMemoryStorage} from '../js/storage.js';
import {get_level_extends,bound_digging} from '../js/mklev.js';
import {may_dig,may_passwall} from '../js/hack.js';
import {COLNO,ROWNO,STONE,ROOM,HWALL,DOOR,TREE,POOL,SDOOR,SCORR,W_NONDIGGABLE,W_NONPASSWALL} from '../js/const.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'map-boundary-oracle-'));
function body(file,type,name){
    const source=fs.readFileSync(path.join(root,'nethack-c/recorder/src/'+file+'.c'),'utf8');
    const marker='\n'+type+'\n'+name+'(',start=source.indexOf(marker)+1;
    assert.ok(start,name+': pinned C definition');assert.equal(source.indexOf(marker,start),-1,name+': unique definition');
    const end=source.indexOf('\n}\n',start);assert.ok(end>start,name);
    return source.slice(start,end+3);
}
const bodies=[body('dungeon','boolean','on_level'),body('mkmaze','void','get_level_extends'),body('mkmaze','void','bound_digging')];
const source='#include "hack.h"\nNEARDATA struct you u;\nstruct instance_globals_saved_l svl;\nstruct instance_globals_saved_d svd;\n'+bodies.join('\n')+`
int main(int argc,char **argv) {
    int maze,earth,typ,flags,x,y;coordxy left,top,right,bottom;
    printf("%d %d %d %d\\n",COLNO,ROWNO,W_NONDIGGABLE,W_NONPASSWALL);
    while(scanf("%d %d",&maze,&earth)==2){
        svl.level.flags.is_maze_lev=maze;
        u.uz.dnum=earth?1:0;u.uz.dlevel=1;
        earth_level.dnum=1;earth_level.dlevel=1;
        for(x=0;x<COLNO;x++)for(y=0;y<ROWNO;y++){
            if(scanf("%d %d",&typ,&flags)!=2)return 2;
            levl[x][y].typ=typ;levl[x][y].wall_info=flags;
        }
        get_level_extends(&left,&top,&right,&bottom);bound_digging();
        printf("%d %d %d %d",left,top,right,bottom);
        for(x=0;x<COLNO;x++)for(y=0;y<ROWNO;y++)printf(" %u",levl[x][y].wall_info);
        putchar('\\n');
    }
    return 0;
}
`;
let groups=0,cells=0;
try{
    fs.writeFileSync(path.join(dir,'oracle.c'),source);
    execFileSync('cc',['-I',path.join(root,'nethack-c/recorder/include'),path.join(dir,'oracle.c'),'-o',path.join(dir,'oracle')],{stdio:['ignore','ignore','pipe']});
    const base=JSON.parse(fs.readFileSync(path.join(root,'tools/gen-sessions/recipes/minetown-map-flags.json'))).segments[0];
    await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    function check(label,maze,earth,map){
        const input=[+maze,+earth];
        for(let x=0;x<COLNO;x++)for(let y=0;y<ROWNO;y++)input.push(map.at(x,y).typ,map.at(x,y).wall_info);
        const rows=execFileSync(path.join(dir,'oracle'),{input:input.join(' ')+'\n',encoding:'utf8'}).trim().split('\n').map(s=>s.split(' ').map(Number));
        assert.deepEqual(rows[0],[COLNO,ROWNO,W_NONDIGGABLE,W_NONPASSWALL]);assert.equal(rows[1].length,4+COLNO*ROWNO);
        game.level=map;game.level.flags.is_maze_lev=maze;game.earth_level={dnum:1,dlevel:1};game.u.uz={dnum:earth?1:0,dlevel:1};
        const [xmin,ymin,xmax,ymax,...flags]=rows[1];
        assert.deepEqual(get_level_extends(),{xmin,xmax,ymin,ymax},label+': compiled C bounds');bound_digging();
        for(let x=0;x<COLNO;x++)for(let y=0;y<ROWNO;y++){
            const loc=map.at(x,y),want=flags[x*ROWNO+y];
            assert.equal(loc.wall_info,want,label+': C wall flags '+x+','+y);cells++;
            if(loc.typ===STONE||loc.typ===HWALL){
                assert.equal(may_dig(x,y),!(want&W_NONDIGGABLE),label+': digging');
                assert.equal(may_passwall(x,y),!(want&W_NONPASSWALL),label+': phasing');
            }
        }
        groups++;
    }
    // Both classification values, Earth bypass, asymmetric edges, and maps
    // touching every grid edge. All-stone input is excluded: C's empty-map
    // search reads beyond levl. These are constructed states, not gameplay.
    for(const maze of [false,true])for(const earth of [false,true])for(const [x1,y1,x2,y2]of [[10,5,20,10],[0,0,9,8],[70,12,79,20],[1,0,79,20]])for(const boundary of [HWALL,ROOM]){
        const map=new GameMap();
        for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)map.at(x,y).typ=(x===x1||x===x2||y===y1||y===y2)?boundary:ROOM;
        for(let x=0;x<COLNO;x++)for(let y=0;y<ROWNO;y++)map.at(x,y).wall_info=(x+3*y)%8;
        check(`rectangle ${x1},${y1},${x2},${y2},${boundary}`,maze,earth,map);
    }
    // Unrelated flag bits, existing restrictions, non-wall terrain and
    // secret doors retain C's exact type-dependent treatment.
    for(const maze of [false,true])for(const earth of [false,true])for(const typ of [STONE,HWALL,DOOR,TREE,POOL,SDOOR,SCORR]){
        const map=new GameMap();
        for(let x=10;x<=20;x++)for(let y=5;y<=10;y++)map.at(x,y).typ=ROOM;
        for(const[x,y]of [[8,4],[9,5],[10,6],[12,7],[21,10],[22,11]]){map.at(x,y).typ=typ;map.at(x,y).wall_info=0x1b;}
        check('mixed terrain '+typ,maze,earth,map);
    }
    console.log(`${groups} constructed maps, ${cells} cell flags match compiled C; digging/phasing checks PASS`);
    console.log('C body SHA256 '+createHash('sha256').update(bodies.join('\n')).digest('hex'));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
