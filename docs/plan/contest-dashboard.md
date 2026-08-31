# Contest score dashboard

Last refreshed: 2026-08-31T01:49:58.741Z. Local commit: `43b2a2d`.
Leaderboard snapshot: 2026-08-30T21:56:37.955Z. Fork last scored: 2026-08-30T21:20:33.472Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 45649/46034 | 99.16% | 248/250 | 2933493/2933493 (100.00%) | 88/1839 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `43b2a2d` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 46027/46034 |
| Cursor positions | 11405/11405 | 45649/46034 |
| Startup and per-turn estimate | 67+0.43/turn | 71+0.16/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.094 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-31T01:49:58.741Z | `43b2a2d` | 11405/11405 | 45649/46034 | 6032/11265 | 3 |
| 2026-08-31T01:35:22.366Z | `2650931` | 11405/11405 | 45159/45544 | 6032/11265 | 3 |
| 2026-08-31T01:04:23.350Z | `f4200e3` | 11405/11405 | 44467/44852 | 6032/11265 | 3 |
| 2026-08-31T00:46:56.712Z | `bad147e` | 11405/11405 | 43910/44295 | 6032/11265 | 3 |
| 2026-08-31T00:20:00.894Z | `a8627c6` | 11405/11405 | 43553/43938 | 6032/11265 | 3 |
| 2026-08-31T00:07:16.233Z | `e3389ef` | 11405/11405 | 43394/43779 | 6032/11265 | 3 |
| 2026-08-30T23:59:00.891Z | `60ca60f` | 11405/11405 | 43196/43581 | 6032/11265 | 3 |
| 2026-08-30T23:47:57.347Z | `0455ebc` | 11405/11405 | 42942/43327 | 6032/11265 | 3 |
| 2026-08-30T23:36:56.047Z | `7a93859` | 11405/11405 | 42825/43210 | 6032/11265 | 3 |
| 2026-08-30T23:24:08.330Z | `98d9cb1` | 11405/11405 | 42298/42683 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
