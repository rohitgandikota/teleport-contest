# Contest score dashboard

Last refreshed: 2026-09-01T19:30:31.080Z. Local commit: `a85b128`.
Leaderboard snapshot: 2026-09-01T05:44:27.234Z. Fork last scored: 2026-09-01T05:17:01.923Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-09-01T14:44:46Z. The live page last scored at 9/1/2026, 8:30:38 AM and still reports rohitgandikota at 11,405 public plus 6,032 held-out screens, 71.9% PRNG, 76.9% screen match, 9 animation frames, 44 plus 9 passing sessions, playable yes, and agentic rank 1.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 77222/77607 | 99.50% | 324/326 | 4151734/4151734 (100.00%) | 289/2606 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `a85b128` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 106/106 | 0 | 0 |
| Explicit C branches | 785/785 | 0 | 0 |

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 77600/77607 |
| Cursor positions | 11405/11405 | 77222/77607 |
| Startup and per-turn estimate | 177+1.23/turn | 164+0.32/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.318 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-09-01T19:30:31.080Z | `a85b128` | 11405/11405 | 77222/77607 | 6032/11265 | 3 |
| 2026-09-01T19:01:51.164Z | `09994d6` | 11405/11405 | 77001/77386 | 6032/11265 | 3 |
| 2026-09-01T17:49:45.921Z | `4dbf578` | 11405/11405 | 75810/76195 | 6032/11265 | 3 |
| 2026-09-01T16:27:12.272Z | `88b8bc1` | 11405/11405 | 71919/72304 | 6032/11265 | 3 |
| 2026-09-01T15:44:44.013Z | `fbf6bb9` | 11405/11405 | 71732/72117 | 6032/11265 | 3 |
| 2026-09-01T14:39:33.452Z | `b52e2eb` | 11405/11405 | 71612/71997 | 6032/11265 | 3 |
| 2026-09-01T14:13:27.900Z | `901bb85` | 11405/11405 | 71484/71869 | 6032/11265 | 3 |
| 2026-09-01T14:06:58.254Z | `b315524` | 11405/11405 | 71484/71869 | 6032/11265 | 3 |
| 2026-09-01T13:47:25.291Z | `b315524` | 11405/11405 | 71307/71692 | 6032/11265 | 3 |
| 2026-09-01T13:04:30.598Z | `f96ba31` | 11405/11405 | 70762/71147 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
