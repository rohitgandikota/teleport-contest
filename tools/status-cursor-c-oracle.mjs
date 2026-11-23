// Extract the pinned tty implementation, compile it in a temporary directory,
// collect constructed-state results, and remove both generated C and binary.
// The backend models text/cursor only. Attributes are compared as field state;
// ANSI output, core botl decisions, critical-HP calculation and mixed gold decoding
// are outside this oracle.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function between(source,start,end) {
    const first=source.indexOf(start),last=source.indexOf(end,first);
    assert.ok(first>=0 && last>first,`Missing pinned C section: ${start}`);
    return source.slice(first,last);
}
function cFunction(source,name) {
    const result=source.match(new RegExp('^void\\n'+name+'\\([^]*?^}', 'm'))?.[0];
    assert.ok(result,`Missing pinned C function: ${name}`);
    return result+'\n';
}

export function statusCursorOracle(cases) {
    const read=name=>readFileSync(new URL('../nethack-c/recorder/'+name,import.meta.url),'utf8');
    const tty=read('win/tty/wintty.c'),term=read('win/tty/termcap.c');
    const botl=read('src/botl.c'),header=read('include/botl.h'),winheader=read('include/wintty.h');
    let definitions=between(header,'enum statusfields {','enum relationships {');
    definitions+=between(header,'enum blconditions {','struct condtests_t {');
    definitions+=between(header,'#define HL_ATTCLR_NONE','#define MAXVALWIDTH');
    definitions+=between(winheader,'struct tty_status_fields {','#endif');
    definitions+=between(botl,'const struct conditions_t conditions[] = {','/* [perhaps');
    const condopts=[...between(botl,'struct condtests_t condtests','\n};')
        .matchAll(/\{\s*bl_\w+,\s*"([^"]+)"/g)].map(match=>match[1]);
    assert.equal(condopts.length,30,'pinned C condition option names');
    definitions+='static const char *condopts[] = {'+condopts.map(JSON.stringify).join(',')+'};\n';
    const prototypes=between(tty,'#define MAX_STATUS_ROWS 3',
        '\n#if (NH_DEVEL_STATUS != NH_STATUS_RELEASED)')+'\n#endif\n';
    let cursors=cFunction(tty,'tty_curs')+cFunction(term,'cl_end');
    const clearBody=between(cFunction(tty,'tty_clear_nhwindow'),'    case NHW_STATUS:',
        '    case NHW_MAP:').replace('    case NHW_STATUS:\n','').replace(/        break;\n$/,'');
    cursors+='static void tty_clear_nhwindow(winid window) { int i,j,m,n; struct WinDesc *cw=wins[window];\n'
        +clearBody+'}\n'+cFunction(botl,'repad_with_dashes');
    const status=between(tty,'extern const char *status_fieldfmt[MAXBLSTATS];',
        '\n#if defined(USER_SOUNDS)');
    let inputs='';
    const update=(field,text,color=8,percent=100)=>
        `update(${field},${JSON.stringify(String(text))},${color},${percent});\n`;
    const masks=values=>'memset(masks,0,sizeof masks);\n'+Object.entries(values||{})
        .map(([index,value])=>`masks[${index}]=${value};\n`).join('');
    for(const sample of cases) {
        inputs+=`setup(${sample.rows},${sample.cols},${sample.hilite||0},${+!!sample.hpbar},${sample.enc||0});\n`;
        inputs+=`crit_input=${+!!sample.critical};\n`+masks(sample.masks);
        for(const field of sample.fields) {
            inputs+=`tty_status_enablefield(${field.field},"test",${JSON.stringify(field.fmt)},TRUE);\n`;
            inputs+=update(field.field,field.text);
        }
        inputs+=update('BL_FLUSH','')+'cmov(37,0);\n';
        for(const action of sample.actions) {
            switch(action.op) {
            case 'update': inputs+=update(action.field,action.text,action.color,action.percent);break;
            case 'flush': inputs+=update('BL_FLUSH','');break;
            case 'reset': inputs+=update('BL_RESET','');break;
            case 'clear': inputs+='tty_clear_nhwindow(WIN_STATUS);\n';break;
            case 'erasing': inputs+=`erasing_tty_screen=${+action.value};\n`;break;
            case 'masks': inputs+=masks(action.value);break;
            case 'cursor': inputs+=`tty_curs(WIN_STATUS,${action.x},${action.y});\n`;break;
            case 'field': inputs+=`tty_putstatusfield(${JSON.stringify(action.text)},${action.x},${action.y});\n`;break;
            case 'clear-eol': inputs+='cl_end();\n';break;
            default: throw Error(`Unknown status action: ${action.op}`);
            }
        }
        inputs+=`snapshot(${JSON.stringify(sample.name)});\n`;
    }
    const temp=mkdtempSync(join(tmpdir(),'status-cursor-oracle-'));
    try {
        writeFileSync(join(temp,'probe.c'),preamble+definitions+support+prototypes+cursors
            +status+main+inputs+'return 0;\n}\n');
        execFileSync('clang',['-std=c11','-Wno-format-security',join(temp,'probe.c'),'-o',join(temp,'probe')]);
        return execFileSync(join(temp,'probe'),[],{encoding:'utf8'})
            .trim().split('\n').map(line=>JSON.parse(line));
    } finally {
        rmSync(temp,{recursive:true,force:true});
    }
}

const preamble=String.raw`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <stdarg.h>
typedef int boolean;
typedef int winid;
typedef void *genericptr_t;
#define TRUE 1
#define FALSE 0
#define STATUS_HILITES 1
#define NO_TERMS 1
#define NOMUX_CAPTURE 1
#define UNUSED
#define NH_DEVEL_STATUS 0
#define NH_STATUS_RELEASED 0
#define NHW_STATUS 2
#define NHW_MAP 3
#define BASE_WINDOW 0
#define WIN_ERR -1
#define ATR_NONE 0
#define ATR_BOLD 1
#define ATR_DIM 2
#define ATR_ITALIC 3
#define ATR_ULINE 4
#define ATR_BLINK 5
#define ATR_INVERSE 7
#define NOW 1
#define BEFORE 0
#define BUFSZ 256
#define CLR_MAX 16
#define NO_COLOR 8
#define SIZE(a) (sizeof(a)/sizeof((a)[0]))
#define Sprintf sprintf
#define Strcpy strcpy
#define Strcat strcat
#define eos(p) ((p)+strlen(p))
#define HUPSKIP() ((void)0)
#define print_vt_code2(a,b) ((void)0)
#define FALLTHROUGH
#define DISABLE_WARNING_FORMAT_NONLITERAL
#define RESTORE_WARNING_FORMAT_NONLITERAL
`;

const support=String.raw`
struct WinDesc { int curx,cury,offx,offy,cols,maxrow,type,rows; char data[3][256]; } window;
struct WinDesc *wins[4];
struct { int curx,cury,lastwin; } terminal, *ttyDisplay=&terminal;
struct { int wc2_statuslines,wc2_hitpointbar,hilite_delta; } iflags;
struct { int botlx; } disp;
int WIN_STATUS=NHW_STATUS,erasing_tty_screen,enc_input,crit_input;
int cond_idx[CONDITION_COUNT];
static const char *CE="clear";
static int CO=80;
static char cells[24][81];
const char *status_fieldfmt[MAXBLSTATS];
char values[MAXBLSTATS][256], *status_vals[MAXBLSTATS];
boolean status_activefields[MAXBLSTATS];
static void panic(const char *s,...) { fputs(s,stderr); exit(2); }
static void paniclog(const char *a,const char *b) { fprintf(stderr,"%s: %s\n",a,b); exit(2); }
static void impossible(const char *s,...) { fputs(s,stderr); exit(2); }
static void ttywindowpanic(void) { panic("bad window"); }
static void cmov(int x,int y) { ttyDisplay->curx=x; ttyDisplay->cury=y; }
static void nocmov(int x,int y) { cmov(x,y); }
static void end_glyphout(void) {}
static void xputs(const char *s) {}
static int xputc(int c) { return c; }
static void nomux_putch(int c) {}
static int paintch(int c) {
    if(ttyDisplay->cury>=0 && ttyDisplay->cury<24 && ttyDisplay->curx>=0 && ttyDisplay->curx<80)
        cells[ttyDisplay->cury][ttyDisplay->curx]=c;
    return c;
}
#define putchar paintch
static void nomux_clear_to_eol(int y,int x) { for(;x<80;x++)cells[y][x]=' '; }
static int term_attr_fixup(int mask) { return mask; }
static void term_start_attr(int a) {}
static void term_end_attr(int a) {}
static void term_start_color(int a) {}
static void term_end_color(void) {}
static int critically_low_hp(int unused) { return crit_input; }
static int stat_cap_indx(void) { return enc_input; }
static char *decode_mixed(char *buf,const char *text) { strcpy(buf,text); return buf; }
static void genl_status_init(void) {
    memset(&window,0,sizeof window); wins[WIN_STATUS]=&window;
    window.offy=24-iflags.wc2_statuslines; window.cols=80;
    window.maxrow=window.rows=iflags.wc2_statuslines;window.type=NHW_STATUS;
    for(int i=0;i<MAXBLSTATS;i++) {
        status_vals[i]=values[i]; values[i][0]=0;status_fieldfmt[i]=NULL;status_activefields[i]=FALSE;
    }
}
static void genl_status_enablefield(int f,const char *nm,const char *fmt,int active) {
    status_fieldfmt[f]=fmt;status_activefields[f]=active;
}
`;

const main=String.raw`
#undef putchar
static int condcmp(const void *av,const void *bv) {
    int a=*(const int*)av,b=*(const int*)bv;
    int delta=conditions[a].ranking-conditions[b].ranking;
    return delta?delta:strcasecmp(condopts[a],condopts[b]);
}
static void setup(int rows,int cols,int hilite,int hpbar,int enc) {
    memset(tty_status,0,sizeof tty_status);memset(finalx,0,sizeof finalx);
    windowdata_init=FALSE;cond_shrinklvl=enc_shrinklvl=dlvl_shrinklvl=0;
    truncation_expected=FALSE;erasing_tty_screen=FALSE;enc_input=enc;
    iflags.wc2_statuslines=rows;iflags.hilite_delta=hilite;iflags.wc2_hitpointbar=hpbar;
    for(int y=0;y<24;y++){memset(cells[y],' ',80);cells[y][80]=0;}
    for(int i=0;i<CONDITION_COUNT;i++)cond_idx[i]=i;
    qsort(cond_idx,CONDITION_COUNT,sizeof(int),condcmp);
    tty_status_init(); window.cols=cols;
}
static unsigned long masks[BL_ATTCLR_MAX];
static void update(int field,const char *text,int color,int percent) {
    if(field==BL_CONDITION) {long bits=strtol(text,NULL,10);tty_status_update(field,&bits,0,percent,color,masks);}
    else tty_status_update(field,(void*)text,0,percent,color,masks);
}
static void snapshot(const char *name) {
    printf("{\"name\":\"%s\",\"cursor\":[%d,%d,1],\"windowCursor\":[%d,%d],\"shrink\":[%d,%d,%d],\"rows\":[",
        name,ttyDisplay->curx,ttyDisplay->cury,window.curx,window.cury,cond_shrinklvl,enc_shrinklvl,dlvl_shrinklvl);
    for(int y=window.offy;y<24;y++)printf("%s\"%s\"",y>window.offy?",":"",cells[y]);
    printf("],\"fields\":[");
    int first=1;
    for(int i=0;i<MAXBLSTATS;i++)if(status_activefields[i]) {
        struct tty_status_fields *s=&tty_status[NOW][i];
        printf("%s[%d,%d,%d,%zu,%d,%d,%d,%d]",first?"":",",i,s->x,s->y,s->lth,s->dirty,s->redraw,s->color,s->attr);first=0;
    }
    printf("]}\n");
}
int main(void) {
`;
