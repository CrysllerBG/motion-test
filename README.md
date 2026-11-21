# motion-test

Animated motion graphics written as code: every frame is computed from a single
number, the time `t`, so a sequence can be played, scrubbed, edited and rendered
to video frame by frame.

This repo has two parts:

- **Motion Studio** (`app/`, `server.js`): an editor where a composition is a JSON file.
  You describe a video to Claude Code, it writes the JSON, and you tweak every
  number in the UI, then export an MP4, with synthesized sound and 3D layers.
- **The reference pieces** (`reference/`): the hand-coded HTML originals the studio grew from.

## Motion Studio

### Run it

You need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install.

```bash
npm start
```

Open http://localhost:4321 in **Chrome or Edge**. (Safari's canvas has no blur filter, so blurs
would be missing there.)

### Make something

- **From a prompt:** ask Claude Code, e.g. *"Make a 6 second intro for my podcast,
  warm colours, the title types in letter by letter."* It writes
  `compositions/<name>.json`, checks it renders, and the open editor reloads on its own.
- **By hand:** click **New**, add layers with **+ Add layer**, and edit them in the inspector.

### Tweak it

| where | what you can do |
|---|---|
| **Layers** (left) | select, add, duplicate, reorder (↑ ↓ = paint earlier/later), hide, delete |
| **Inspector** (right) | every property as a slider, number, colour or menu. **Drag a property's name sideways** to scrub its value (Shift = 10× faster). ◆ marks animated properties, ↺ resets to default. Animations show from / to / start / duration / easing with a curve preview. |
| **Stage** | drag the purple handle to move the selected layer |
| **Timeline** (bottom) | drag a bar to move an animation in time; drag its edges to change when it starts or how long it lasts (snaps to 0.05 s; hold Alt to move freely). Click empty space to scrub. |
| **Sound** | click **Sound off** (under the stage) to turn it on. Continuous sounds (drone, fire, wind, crackle) are listed under **Sound** in the Layers panel and animate like any layer. One-shot sounds are diamonds in the **♪ Cues** lane: drag to retime, **+** to add one at the playhead, ▶ Preview in the inspector. Every sound is synthesized, no audio files. |
| **3D** | **+ Add layer → 3D die (D20)**. Animate `tumble` 0→1 to roll it onto any `face`; its shadow falls on the layers behind it. |

Keys: Space play/pause · ← → one frame · Home to start · Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo ·
Ctrl/Cmd+S save · Esc deselect.

**Save** writes the JSON file. If Claude Code changes the file while you have unsaved
edits, the editor asks before reloading, and Undo brings your edits back.

### Export

**Export video** renders each frame at its exact time and encodes an H.264 MP4 in the
browser, so the video matches the preview frame for frame. Sound is rendered separately
(faster than real time, every cue at its exact moment) and added as AAC. From the command line
(with the server running, needs Playwright):

```bash
npm run export -- northern-lights
```

`compositions/dungeon-roller-3d.json` shows everything together: a 3D die, 2D layers
and a full soundscape.

### Files

| path | what |
|---|---|
| `compositions/*.json` | your pieces ([format reference](docs/composition-format.md)) |
| `app/engine/` | compile → tracks → `scene` → paint; one module per layer type in `elements/`; sound in `audio/`; Three.js support in `three/` |
| `app/editor/` | the editor UI and the exporter |
| `tools/` | `validate.mjs`, `render-frames.mjs` (PNG frames), `export.mjs` (MP4), `gen-docs.mjs` |
| `exports/`, `renders/` | output (not committed) |

## The reference pieces

| File | Length | What it shows | Needs internet? |
|---|---|---|---|
| [`reference/northern-lights-titles.html`](reference/northern-lights-titles.html) | 6 s | A cinematic title sequence: staggered letters, a self-drawing line, a tiny timeline engine in about 15 lines | Only for fonts |
| [`reference/dungeon-roller-trailer.html`](reference/dungeon-roller-trailer.html) | 15 s | A trailer for a medieval dungeon crawler: torchlight, an iron portcullis, parchment scrolls, and a hand-built 3D D20 that always lands on 20. No libraries. | Only for fonts |
| [`reference/dungeon-roller-v2.html`](reference/dungeon-roller-v2.html) | 15 s | The same trailer with the die and lighting rendered by Three.js and a soundtrack synthesized live by Tone.js | Yes (loads both libraries) |

Download a file and double-click it, and it plays in any browser. For v2, click
**Sound off** to turn sound on, then **Replay**. Browsers only allow audio after a click.

`compositions/northern-lights.json` is the first piece rebuilt as data; it matches the
original frame for frame.

## Working on it with Claude Code

`CLAUDE.md` describes the architecture, the prompt-to-composition workflow and working
preferences. Claude Code reads it automatically at the start of every session.

Third-party code in `app/vendor/`, all MIT-licensed (licences alongside): mp4-muxer 5.2.2,
Three.js r128, Tone.js 14.8.49.
