# motion-test

Animated motion graphics written as code: every frame is computed from a single
number, the time `t`, so a sequence can be played, scrubbed, edited and
(eventually) rendered to video frame by frame.

## The pieces

| File | Length | What it shows | Needs internet? |
|---|---|---|---|
| [`reference/northern-lights-titles.html`](reference/northern-lights-titles.html) | 6 s | A cinematic title sequence: staggered letters, a self-drawing line, a tiny timeline engine in about 15 lines | Only for fonts |
| [`reference/dungeon-roller-trailer.html`](reference/dungeon-roller-trailer.html) | 15 s | A trailer for a medieval dungeon crawler: torchlight, an iron portcullis, parchment scrolls, and a hand-built 3D D20 that always lands on 20. No libraries. | Only for fonts |
| [`reference/dungeon-roller-v2.html`](reference/dungeon-roller-v2.html) | 15 s | The same trailer with the die and lighting rendered by Three.js and a soundtrack synthesized live by Tone.js | Yes (loads both libraries) |

## Viewing them

Download a file and double-click it, and it plays in any browser. Each page has
a scrubber and timeline lanes under the stage: drag the scrubber to stop time at
any moment and see which animation tracks are active.

For v2, click **Sound off** to turn sound on, then **Replay**. Browsers only
allow audio after a click.

## Working on it with Claude Code

`CLAUDE.md` describes the architecture and working preferences. Claude Code
reads it automatically at the start of every session.
