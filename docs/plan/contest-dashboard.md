# Contest score dashboard

Last refreshed: 2026-08-31T01:04:23.350Z. Local commit: `f4200e3`.
Leaderboard snapshot: 2026-08-30T21:56:37.955Z. Fork last scored: 2026-08-30T21:20:33.472Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 44467/44852 | 99.14% | 240/242 | 2909744/2909744 (100.00%) | 88/1839 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `f4200e3` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 44845/44852 |
| Cursor positions | 11405/11405 | 44467/44852 |
| Startup and per-turn estimate | 57+0.45/turn | 71+0.17/turn |

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
| 2026-08-31T01:04:23.350Z | `f4200e3` | 11405/11405 | 44467/44852 | 6032/11265 | 3 |
| 2026-08-31T00:46:56.712Z | `bad147e` | 11405/11405 | 43910/44295 | 6032/11265 | 3 |
| 2026-08-31T00:20:00.894Z | `a8627c6` | 11405/11405 | 43553/43938 | 6032/11265 | 3 |
| 2026-08-31T00:07:16.233Z | `e3389ef` | 11405/11405 | 43394/43779 | 6032/11265 | 3 |
| 2026-08-30T23:59:00.891Z | `60ca60f` | 11405/11405 | 43196/43581 | 6032/11265 | 3 |
| 2026-08-30T23:47:57.347Z | `0455ebc` | 11405/11405 | 42942/43327 | 6032/11265 | 3 |
| 2026-08-30T23:36:56.047Z | `7a93859` | 11405/11405 | 42825/43210 | 6032/11265 | 3 |
| 2026-08-30T23:24:08.330Z | `98d9cb1` | 11405/11405 | 42298/42683 | 6032/11265 | 3 |
| 2026-08-30T23:11:34.299Z | `a74751d` | 11405/11405 | 41706/42091 | 6032/11265 | 3 |
| 2026-08-30T22:59:57.884Z | `58d419f` | 11405/11405 | 41328/41713 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
