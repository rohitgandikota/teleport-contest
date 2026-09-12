// tools/unawaited.mjs — list statement calls of async functions that lack
// `await`. An un-awaited async call runs only until its first `await`; every
// side effect after that point happens on a later microtask, i.e. after the
// caller's next RNG draw or message, which is how a demon's cuss() left its
// neighbours asleep (NOTES "Tour seed 108"). Each line is
//   ASYNC|SYNC|TOP file:line in <enclosing function>: <call>
// ASYNC = the enclosing function is async, so `await` is the fix; SYNC = the
// enclosing function is synchronous and the C's ordering needs a closer look.
import fs from 'node:fs';
const files = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f)
  .concat(fs.readdirSync('js/tty').filter(f => f.endsWith('.js')).map(f => 'js/tty/' + f));
const asyncNames = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/^(?:export )?async function ([A-Za-z_$][\w$]*)\s*\(/gm)) asyncNames.add(m[1]);
}
const kw = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'do', 'try', 'return', 'function']);
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const src = lines.join('\n');
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s*([A-Za-z_$][\w$]*)\((.*)\);\s*(\/[/*].*)?$/);
    if (!m) return;
    const name = m[1];
    if (!asyncNames.has(name)) return;
    /* a synchronous function of the same name in this file shadows the async one */
    if (new RegExp(`^(?:export )?function ${name}\\s*\\(`, 'm').test(src)) return;
    let enc = null;
    const myIndent = ln.search(/\S/);
    for (let j = i - 1; j >= 0; j--) {
      const L = lines[j];
      const ind = L.search(/\S/);
      if (ind < 0 || ind >= myIndent) continue;
      let mm;
      if ((mm = L.match(/^(?:export )?(async )?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/))) { enc = { async: !!mm[1], name: mm[2] }; break; }
      if ((mm = L.match(/^(?:export )?(?:const|let) ([A-Za-z_$][\w$]*) = (async )?(?:\([^)]*\)|[A-Za-z_$][\w$]*) =>/))) { enc = { async: !!mm[2], name: mm[1] }; break; }
      if ((mm = L.match(/^\s*(async )?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/)) && !kw.has(mm[2])) { enc = { async: !!mm[1], name: mm[2] + '(method)' }; break; }
      if ((mm = L.match(/(async )?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{\s*$/))) { enc = { async: !!mm[1], name: 'arrow@' + (j + 1) }; break; }
      if ((mm = L.match(/^\s*(?:[A-Za-z_$][\w$]*\s*[:=]\s*)?(async )?function\s*\(/))) { enc = { async: !!mm[1], name: 'anon@' + (j + 1) }; break; }
    }
    console.log(`${enc ? (enc.async ? 'ASYNC' : 'SYNC') : 'TOP'} ${f}:${i + 1} in ${enc ? enc.name : '?'}: ${ln.trim().slice(0, 90)}`);
  });
}
