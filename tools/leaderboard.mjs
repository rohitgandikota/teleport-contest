#!/usr/bin/env node
// leaderboard.mjs — where we actually stand, including the held-out half.
//
// The page at https://mazesofmenace.ai/leaderboard/ renders its table from
// JavaScript, so fetching the HTML shows only "Loading…". The data is at
// /leaderboard/data.json and is what this reads.
//
// The held-out column is the one that matters and is the one we cannot measure
// locally: 44 sessions we never see, scored server-side after the judge cron
// picks up a push (roughly every two hours).
//
// Usage:
//   node tools/leaderboard.mjs           # standings by held-out points
//   node tools/leaderboard.mjs --public  # standings by public points
//   node tools/leaderboard.mjs --json    # raw record for our fork

const URL = 'https://mazesofmenace.ai/leaderboard/data.json';
const US = 'rohitgandikota/teleport-contest';

const args = process.argv.slice(2);
const byPublic = args.includes('--public');
const asJson = args.includes('--json');

const res = await fetch(`${URL}?t=${Date.now()}`);
if (!res.ok) {
    console.error(`leaderboard fetch failed: ${res.status} ${res.statusText}`);
    process.exit(2);
}
const data = await res.json();

const us = data.teams.find(t => t.fork === US);
if (asJson) {
    console.log(JSON.stringify(us, null, 2));
    process.exit(0);
}

const key = byPublic ? 'public' : 'heldOut';
const rows = data.teams
    .map(t => ({
        fork: t.fork || t.name,
        held: t.heldOut || {},
        pub: t.public || {},
        when: t.lastScored,
    }))
    .sort((a, b) => (b[byPublic ? 'pub' : 'held'].points || 0)
                  - (a[byPublic ? 'pub' : 'held'].points || 0));

const T = process.stdout.isTTY
    ? { bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', off: '\x1b[0m' }
    : { bold: '', dim: '', cyan: '', off: '' };

const pct = v => (v == null ? '   -  ' : `${v.toFixed(1).padStart(5)}%`);
const pts = v => String(v ?? 0).padStart(6);

console.log(`${T.dim}scored ${data.timestamp}  ·  phase: ${data.contestPhase}`
            + `  ·  sorted by ${key}${T.off}\n`);
console.log(`${T.bold}  #  ${'HELD-OUT'.padStart(6)} ${'scr%'.padStart(6)} `
            + `${'rng%'.padStart(6)} ${'pass'.padStart(5)}   `
            + `${'PUBLIC'.padStart(6)} ${'scr%'.padStart(6)} ${'pass'.padStart(5)}`
            + `   fork${T.off}`);

rows.forEach((r, i) => {
    const mine = r.fork === US;
    const mark = mine ? T.cyan + T.bold : '';
    console.log(`${mark}${String(i + 1).padStart(3)}  `
        + `${pts(r.held.points)} ${pct(r.held.screenPct)} ${pct(r.held.rngPct)} `
        + `${String(`${r.held.passing ?? 0}/${r.held.total ?? 44}`).padStart(5)}   `
        + `${pts(r.pub.points)} ${pct(r.pub.screenPct)} `
        + `${String(`${r.pub.passing ?? 0}/${r.pub.total ?? 44}`).padStart(5)}`
        + `   ${r.fork}${mine ? '  <- us' : ''}${T.off}`);
});

if (us) {
    const h = us.heldOut || {}, p = us.public || {};
    const rank = rows.findIndex(r => r.fork === US) + 1;
    const ratio = p.points ? (h.points / p.points) : 0;
    console.log(`\n${T.bold}us:${T.off} rank ${rank}/${rows.length} by ${key}`);
    console.log(`  held-out  ${h.points}/${h.maxPoints} screens `
                + `(${(h.screenPct ?? 0).toFixed(2)}%), rng ${(h.rngPct ?? 0).toFixed(1)}%, `
                + `${h.passing}/${h.total} sessions`);
    console.log(`  public    ${p.points}/${p.maxPoints} screens `
                + `(${(p.screenPct ?? 0).toFixed(2)}%), rng ${(p.rngPct ?? 0).toFixed(1)}%, `
                + `${p.passing}/${p.total} sessions`);
    console.log(`  ${T.dim}held-out / public = ${ratio.toFixed(2)}  `
                + `— how well the port GENERALISES. A high public score with a `
                + `low ratio is the overfitting signature.${T.off}`);
    console.log(`  ${T.dim}last scored ${us.lastScored}${T.off}`);
}
