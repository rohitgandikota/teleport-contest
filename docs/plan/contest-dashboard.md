# Contest score dashboard

Last refreshed: 2026-08-25T18:05:11.157Z. Local commit: `ce87fbf`.
Leaderboard snapshot: 2026-08-25T13:53:33.751Z. Fork last scored: 2026-08-25T13:18:07.116Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 8711/11405 | 76.38% | 39/44 | 513667/792838 (64.79%) | 6/1483 |
| Public leaderboard | 6642/11405 | 58.24% | 34/44 | 49.80% | 6/1483 |
| Held-out leaderboard | 4256/11265 | 37.78% | 1/44 | 16.82% | 0/2959 |
| Supplemental C suite | 2012/3739 | 53.81% | 17/40 | 379329/470994 (80.54%) | 0/75 |

## Contest position and generalization

- Held-out rank: **5/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.641**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 8715/11405 | 2012/3739 |
| Cursor positions | 9751/11405 | 2694/3739 |
| Startup and per-turn estimate | 70+0.35/turn | 60+0.49/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.337 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 17867.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T18:05:11.157Z | `ce87fbf` | 8711/11405 | 2012/3739 | 4256/11265 | 5 |
| 2026-08-25T17:56:06.702Z | `4e1cb46` | 8711/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:41:12.331Z | `3c2d1b8` | 8668/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:27:45.262Z | `0d0c87e` | 8638/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:22:25.598Z | `92ef4f2` | 8548/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T17:01:55.529Z | `e3b2a1f` | 8356/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T16:45:58.101Z | `c65c42c` | 8250/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T16:14:16.087Z | `45353be` | 7844/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T15:25:05.130Z | `cc78177` | 7573/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T15:12:55.263Z | `ac97e0e` | 7542/11405 | 2002/3739 | 4256/11265 | 5 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
