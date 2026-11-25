// Compare the actual pinned C owners with the public JS string helper.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ing_suffix} from '../js/hacklib.js';

const source=readFileSync(new URL('../nethack-c/upstream/src/hacklib.c',import.meta.url),'utf8');
const header=readFileSync(new URL('../nethack-c/upstream/include/global.h',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
function owner(name) {
    const match=source.match(new RegExp('^[^\\n]+\\n'+name+'\\([^]*?^}', 'm'));
    assert.ok(match,`complete C owner ${name}`);
    return match[0];
}
const macros=[
    /^#define BUFSZ 256[^\n]*/m,
    /^#define Strcpy \(void\) strcpy/m,
    /^#define Strcat \(void\) strcat/m,
    /^#define strcmpi\(a, b\) strncmpi\(\(a\), \(b\), -1\)/m,
].map(pattern=>{const m=header.match(pattern);assert.ok(m);return m[0];});
const owners=['lowc','eos','strncmpi','ing_suffix'];
const program=['#include <stdio.h>','#include <string.h>','#include <assert.h>',
    ...macros,...owners.map(owner),`
int main(void) {
    char line[BUFSZ * 2 + 2], input[BUFSZ];
    while (fgets(line, sizeof line, stdin)) {
        size_t n = strcspn(line, "\\n");
        assert(n % 2 == 0 && n / 2 <= BUFSZ - 5);
        for (size_t i = 0; i < n / 2; ++i) {
            unsigned byte;
            assert(sscanf(line + 2 * i, "%2x", &byte) == 1);
            input[i] = (char) byte;
        }
        input[n / 2] = '\\0';
        const unsigned char *result = (const unsigned char *) ing_suffix(input);
        while (*result) printf("%02x", *result++);
        putchar('\\n');
    }
    return 0;
}`].join('\n\n');

const cases=new Set(['']);
let level=[''];
for(let length=1;length<=4;length++){
    level=level.flatMap(prefix=>[...'aAeEiIpPtTyY'].map(c=>prefix+c));
    for(const value of level)cases.add(value);
}
for(const word of ['step','float','fly','slither','ooze','wiggle','crawl','tip',
    'rub','dip','take','put','grease','vie','tie','strike','bash','squeal','meow','growl']) {
    for(const spelling of [word,word.toUpperCase(),word[0].toUpperCase()+word.slice(1)])
        for(const tail of ['',' on',' OFF',' wiTh'])cases.add(spelling+tail);
}
for(const text of [' on',' OFF',' wiTh','run\0drop','\0tip','paé','paÅ',
    'Éat','İE','pūT','a🚀','p\0at','tIp','plaY','paé on'])cases.add(text);
const inputs=[...cases];
assert.ok(inputs.every(s=>Buffer.byteLength(s)<=251));
const temp=mkdtempSync(join(tmpdir(),'contest-ing-suffix-'));
let expected;
try {
    const src=join(temp,'reference.c'),exe=join(temp,'reference');
    writeFileSync(src,program);
    execFileSync('cc',['-std=c99','-Wall','-Wextra','-Werror',src,'-o',exe],
        {encoding:'utf8',timeout:15000});
    const output=execFileSync(exe,[],{encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024,
        input:inputs.map(s=>Buffer.from(s).toString('hex')).join('\n')+'\n'});
    expected=output.trimEnd().split('\n').map(s=>Buffer.from(s,'hex').toString('utf8'));
} finally { rmSync(temp,{recursive:true,force:true}); }
assert.equal(expected.length,inputs.length);
const failures=[];
for(const [index,input] of inputs.entries()){
    const actual=ing_suffix(input);
    if(actual!==expected[index])failures.push({input,c:expected[index],js:actual});
}
const report={total:inputs.length,passed:inputs.length-failures.length,
    cSourceSHA256:hash(source),headerSHA256:hash(header),owners,
    inputsSHA256:hash(JSON.stringify(inputs)),referenceSHA256:hash(JSON.stringify(expected)),
    failures,limits:['Bounded defined C string inputs; no C buffer overflow cases.',
        'Direct native helper comparison, not ordinary gameplay or Lua bridge parity.']};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,failures:failures.slice(0,12)}));
if(failures.length)process.exitCode=1;
