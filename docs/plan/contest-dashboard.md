# Contest score dashboard

Last refreshed: 2026-08-25T13:37:42.085Z. Local commit: `2e69485`.
Leaderboard snapshot: 2026-08-25T07:43:19.512Z. Fork last scored: 2026-08-25T07:13:17.049Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 7041/11405 | 61.74% | 34/44 | 465499/792838 (58.71%) | 6/1483 |
| Public leaderboard | 5235/11405 | 45.90% | 21/44 | 40.34% | 0/1483 |
| Held-out leaderboard | 3506/11265 | 31.12% | 1/44 | 16.13% | 0/2959 |
| Supplemental C suite | 2002/3739 | 53.54% | 15/40 | 379315/470994 (80.53%) | 0/75 |

## Contest position and generalization

- Held-out rank: **5/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.670**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 7045/11405 | 2002/3739 |
| Cursor positions | 8960/11405 | 2712/3739 |
| Startup and per-turn estimate | 65+0.33/turn | 53+0.48/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 1.562 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18044.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T13:37:42.085Z | `2e69485` | 7041/11405 | 2002/3739 | 3506/11265 | 5 |
| 2026-08-25T13:22:36.821Z | `9c8c6a0` | 6795/11405 | 2002/3739 | 3506/11265 | 5 |
| 2026-08-25T12:26:31.748Z | `c27bbdc` | 6642/11405 | 1869/3739 | 3506/11265 | 5 |
| 2026-08-25T11:00:45.834Z | `fe1c582` | 6240/11405 | 1869/3739 | 3506/11265 | 5 |
| 2026-08-25T09:58:30.729Z | `9127b54` | 6029/11405 | 1845/3739 | 3506/11265 | 5 |
| 2026-08-25T09:18:12.347Z | `bd62cf9` | 5978/11405 | 1844/3739 | 3506/11265 | 5 |
| 2026-08-25T09:03:09.427Z | `2186619` | 5975/11405 | 1844/3739 | 3506/11265 | 5 |
| 2026-08-25T08:37:27.977Z | `6f8a5fe` | 5917/11405 | 1844/3739 | 3506/11265 | 5 |
| 2026-08-25T08:18:32.442Z | `c6430b7` | 5890/11405 | 1844/3739 | 3506/11265 | 5 |
| 2026-08-25T07:51:10.141Z | `e617284` | 5803/11405 | 1844/3739 | 3506/11265 | 5 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
