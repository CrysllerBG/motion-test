# Composition format

A composition is one JSON file in `compositions/`. The editor plays and edits it, `tools/` render
and export it, and Claude Code writes it from a prompt. This page is the reference for all three.

## The idea in one paragraph

Every frame is a pure function of one number, the time `t`. The file lists **layers** (what is
drawn) and their **animations** (how a property changes between two moments). `compile()` turns
each animation into a *track*; `evaluate(t)` writes each track's eased 0..1 progress into a
`scene` object; `resolve()` combines that progress with the layer's base props; `paint` draws.
Nothing is remembered between frames, which is why scrubbing, playback and export always agree.

## Units

| what | unit |
|---|---|
| `x`, `y` (positions) | % of the frame: `x` of its width, `y` of its height. `50, 50` is the centre. |
| every other length (`size`, `width`, `dx`, `blur`, `thickness`, …) | % of the frame **width**, like CSS `cqw`. `size: 7.2` is 7.2 % of the width. |
| times (`start`, `duration`, `period`, `stagger`) | seconds |
| angles | degrees |
| colours | `"#rrggbb"`, `"#rrggbbaa"` (last pair is transparency), or `"rgba(r,g,b,a)"` |

Because lengths are relative, one file renders identically at 960 px or 4K. On a 16:9 frame the
height is 56.25 width-units, so a full-frame rectangle is `"width": 100, "height": 56.25`.

## File structure

```json
{
  "name": "Northern Lights",
  "notes": "What this piece is, in words. Helps the next person (or Claude) editing it.",
  "duration": 6,
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "seed": 7,
  "background": "#000000",
  "fonts": ["Italiana", "Jost:300"],
  "layers": [ … ]
}
```

- `fonts`: Google Fonts families the text layers use. `"Jost:300"` adds weight 300; `"Jost:300,500"`
  adds two; `"IM Fell English:400i"` adds the italic. Canvas text can only use loaded fonts.
- `seed`: changes every random pattern (particles, textures) at once. Same seed = same picture.
- Layers are painted **in order**: the first is at the back.

## Layers

```jsonc
{
  "id": "title",              // unique; letters, digits, - and _
  "type": "text",             // see "Layer types" below
  "label": "Title",           // optional: the name shown in the timeline
  "notes": "…",               // optional
  "hidden": true,             // optional: skip it (also in export)
  "props": { "y": 43.56, "size": 7.2, "font": "Italiana" },   // base values; anything left out uses the default
  "animate": [ … ],
  "children": [ … ]           // groups only
}
```

Text layers also take `"text"` (use `\n` for line breaks), `"split": "letters" | "words"`,
`"stagger"` (seconds between pieces) and `"staggerFrom": "start" | "end" | "center"`.

A **group** applies its opacity, offset, scale and rotation to all its children, around its
anchor `x`, `y`. Use groups to fade or move several layers together, e.g. a `"Fade out"` group
around all the type, or a gentle push-in on a whole composition.

## Animations

```json
{ "prop": "opacity", "from": 0, "to": 1, "start": 1.5, "duration": 0.7, "ease": "outCubic" }
```

Only number and colour props can animate. On a split text layer each animation runs once per
letter/word, offset by the stagger.

**How several animations on one property combine** (in start order):

1. Before the first animation starts, the property holds that animation's `from`. That's why a
   fade-in starts invisible even though the base opacity is 1.
2. Each animation moves the value from its `from` to its `to`. Leave `from` out to start from
   wherever the previous animation left it (handy for "then fade back out": `{ "to": 0, … }`).
3. Waves are added on top.

**Waves** are ambient motion that never ends: a sine wave added to a number for the whole piece.

```json
{ "prop": "dx", "wave": { "amp": 4.2, "period": 9, "phase": 0.25 } }
```

`amp` is how far it moves either way, `period` the seconds per cycle, `phase` where in the cycle
it starts (0..1; 0.25 turns a sine into a cosine). Several waves with short, unrelated periods
on the same prop make a convincing flicker (see the torches in `dungeon-roller-title.json`).

## Recipes

| effect | how |
|---|---|
| letters rise in one by one | text with `"split": "letters"`, `"stagger": 0.06`; animate `opacity` 0→1, `dy` 4→0, `blur` 0.6→0 with `outCubic` |
| a line draws itself | `line` with `draw` 0→1; `"origin": "center"` grows both ways |
| an outline traces itself | `shape` with `stroke` + `strokeWidth`, animate `draw` 0→1 (the fill appears once it's complete) |
| stamp / slam in | `scale` 1.5→1 with `outCubic` or `outBack`, `opacity` 0→1 over ~0.2 s, `blur` 0.4→0 |
| a flash of light | `glow` with `blend: "screen"`: `opacity` 0→0.85 over 0.08 s, then `{ "to": 0 }` over ~0.9 s |
| the frame breathes | group around the content, `scale` 1→1.015 over a few seconds, `inOutQuad` |
| fade to black | full-frame black `shape` on top, `opacity` 0→1 |
| unroll a banner | `shape` rect, animate `width` from 0 |
| torchlight | `glow` with 2–3 short `opacity` waves + `particles` preset `embers` |
| film look | `noise` `grain` at opacity ~0.06 + `vignette` |

## Layer types and their props

These tables are generated from the code by `node tools/gen-docs.mjs`. Don't edit them by hand.

<!-- generated:start -->
Number ranges are the editor's slider ranges, not limits: values outside them are fine.

### Props every layer has

Text applies these per letter/word (around each piece's centre); other layers apply them around their own `x`, `y`.

| prop | type | default | notes |
|---|---|---|---|
| `opacity` | number 0 … 1 | `1` |  |
| `dx` | number -100 … 100 | `0` | offset right, % of width |
| `dy` | number -100 … 100 | `0` | offset down, % of width |
| `scale` | number 0 … 5 | `1` |  |
| `rotate` | number -360 … 360 | `0` | degrees |
| `blur` | number 0 … 10 | `0` | % of width |
| `blend` | `normal` · `screen` · `lighter` · `multiply` · `overlay` · `soft-light` | `"normal"` |  |

### `background`

| prop | type | default | notes |
|---|---|---|---|
| `fill` | fill | `"#101018"` |  |

### `group`

| prop | type | default | notes |
|---|---|---|---|
| `x` | number -50 … 150 | `50` | anchor, % of width |
| `y` | number -50 … 150 | `50` | anchor, % of height |

### `glow`

Overrides: `blend` = `"screen"`.

| prop | type | default | notes |
|---|---|---|---|
| `x` | number -50 … 150 | `50` | centre, % of width |
| `y` | number -50 … 150 | `50` | centre, % of height |
| `width` | number 0 … 200 | `60` | % of width |
| `height` | number 0 … 200 | `40` | % of width |
| `color` | color | `"#5fe3b48c"` |  |
| `softness` | number 0 … 20 | `4` | extra blur, % of width |

### `text`

| prop | type | default | notes |
|---|---|---|---|
| `x` | number -50 … 150 | `50` | % of width |
| `y` | number -50 … 150 | `50` | centre of the line, % of height |
| `size` | number 0.2 … 40 | `6` | font size, % of width |
| `font` | font | `"Georgia"` |  |
| `weight` | number 100 … 900 | `400` |  |
| `italic` | bool | `false` |  |
| `color` | color | `"#ffffff"` |  |
| `letterSpacing` | number -0.2 … 1.5 | `0` | em |
| `lineHeight` | number 0.6 … 3 | `1.2` | multiple of size |
| `align` | `left` · `center` · `right` | `"center"` |  |
| `shadowColor` | color | `"#00000000"` |  |
| `shadowBlur` | number 0 … 10 | `0` | % of width |

### `line`

| prop | type | default | notes |
|---|---|---|---|
| `x` | number -50 … 150 | `50` | centre, % of width |
| `y` | number -50 … 150 | `50` | centre, % of height |
| `length` | number 0 … 200 | `40` | % of width |
| `angle` | number -180 … 180 | `0` | degrees |
| `thickness` | number 0 … 5 | `0.15` | % of width |
| `color` | color | `"#ffffff"` |  |
| `draw` | number 0 … 1 | `1` | how much is drawn, 0..1 |
| `origin` | `center` · `start` · `end` | `"center"` |  |
| `cap` | `butt` · `round` · `square` | `"butt"` |  |

### `shape`

| prop | type | default | notes |
|---|---|---|---|
| `shape` | `rect` · `circle` · `polygon` | `"rect"` |  |
| `x` | number -50 … 150 | `50` | centre, % of width |
| `y` | number -50 … 150 | `50` | centre, % of height |
| `width` | number 0 … 200 | `20` | % of width (circle/polygon: diameter) |
| `height` | number 0 … 200 | `10` | % of width (rect only) |
| `radius` | number 0 … 50 | `0` | corner radius, % of width |
| `sides` | number 3 … 24 | `6` |  |
| `fill` | color | `"#ffffff"` |  |
| `stroke` | color | `"#00000000"` |  |
| `strokeWidth` | number 0 … 5 | `0` | % of width |
| `draw` | number 0 … 1 | `1` | outline reveal, 0..1 |

### `particles`

| prop | type | default | notes |
|---|---|---|---|
| `preset` | `embers` · `dust` · `snow` · `sparkles` | `"embers"` |  |
| `count` | number 0 … 600 | `60` |  |
| `x` | number -50 … 150 | `50` | emitter centre, % of width |
| `y` | number -50 … 150 | `80` | emitter centre, % of height |
| `width` | number 0 … 200 | `10` | emitter width, % of width |
| `height` | number 0 … 200 | `0` | emitter height, % of width |
| `color` | color |  |  |
| `size` | number 0 … 5 |  | radius, % of width |
| `speedX` | number -50 … 50 |  | % of width per second |
| `speedY` | number -50 … 50 |  | % of width per second (negative rises) |
| `spreadX` | number 0 … 20 |  | random sideways speed |
| `sway` | number 0 … 10 |  | side-to-side wobble, % of width |
| `gravity` | number -20 … 20 |  |  |
| `life` | number 0.1 … 30 |  | seconds each particle lives |
| `twinkle` | number 0 … 1 |  |  |
| `seed` | number 0 … 9999 | `1` |  |

Presets fill in any prop you don't set:

| preset | color | size | speedY | speedX | spreadX | sway | life | gravity | twinkle | blend |
|---|---|---|---|---|---|---|---|---|---|---|
| `embers` | `#ffa94d` | `0.4` | `-9` | `0` | `2` | `0.8` | `2.6` | `0` | `0` | `lighter` |
| `dust` | `#c8b49a` | `0.35` | `-0.6` | `0.4` | `1` | `0.6` | `6` | `0` | `0` | `screen` |
| `snow` | `#ffffff` | `0.3` | `6` | `0.5` | `1` | `1.2` | `9` | `0` | `0` | `normal` |
| `sparkles` | `#fff2c4` | `0.3` | `0` | `0` | `0` | `0` | `1.6` | `0` | `1` | `lighter` |

### `noise`

Overrides: `opacity` = `0.08`, `blend` = `"overlay"`.

| prop | type | default | notes |
|---|---|---|---|
| `kind` | `grain` · `paper` · `stone` | `"grain"` |  |
| `color` | color | `"#ffffff"` |  |
| `animated` | bool | `true` | grain changes 12× per second |
| `seed` | number 0 … 9999 | `1` |  |

### `vignette`

| prop | type | default | notes |
|---|---|---|---|
| `color` | color | `"#000000"` |  |
| `inner` | number 0 … 150 | `35` | clear radius, % of height |
| `outer` | number 0 … 150 | `62` | full-dark radius, % of width |
| `strength` | number 0 … 1 | `0.7` |  |

### Easings

`linear` · `inQuad` · `outCubic` · `inOutQuad` · `outBounce` · `inCubic` · `inOutCubic` · `outExpo` · `outBack` · `step`
<!-- generated:end -->

## Checking a composition

```bash
node tools/validate.mjs compositions/my-piece.json      # problems, with their location in the file
node tools/render-frames.mjs my-piece 0.5 2 4.2         # PNGs in renders/my-piece/ (server must be running)
node tools/export.mjs my-piece                           # exports/my-piece.mp4 (server must be running)
```

Errors point at the exact spot, e.g. `layers[3].animate[1].ease: unknown easing "outQuint"`.

## Not possible yet (ideas for later)

- Masks / clipping: a texture can't be confined to the inside of a shape yet.
- Images, SVG files and video as layers.
- Sound (Tone.js, rendered into the MP4).
- 3D (Three.js) layers.
- A "shake" that only happens during a time window (waves run for the whole piece).
- A dedicated flame element (the reference trailer's torches are hand-drawn bezier flames).
