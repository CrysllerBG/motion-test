# Project: code-driven motion graphics

## Background
The files in /reference are animated motion graphics made with code, built in an
earlier conversation. They are the starting point for this project. Read them
before proposing anything.

- northern-lights-titles.html: 6 s title sequence, plain JS + SVG, no libraries
- dungeon-roller-trailer.html: 15 s game trailer, Canvas 2D + SVG, no libraries,
  hand-written 3D D20 (projection, painter's algorithm, flat shading)
- dungeon-roller-v2.html: same trailer, die and lighting in Three.js (r128),
  sound synthesized live with Tone.js (14.8.49)

## Core architecture (keep these principles)
1. Everything is a pure function of time `t`. Nothing is carried between frames,
   so scrubbing, replaying and frame-by-frame export all give identical results.
2. Tracks only produce numbers. `track(group, key, start, duration, easing)`
   writes an eased 0..1 value into a `scene` object. Tracks never touch the DOM.
   (The Northern Lights piece is the earlier, simpler form, where tracks still
   write to the page directly.)
3. Painting is separate. A paint step reads `scene` and draws. When several
   tracks affect one property (e.g. gate rises, later slams), paint combines them.
4. Layers: WebGL/Canvas for the world, a 2D canvas for particles, HTML/SVG on
   top for typography and ornaments. Each tool does what it's best at.
5. Randomness is seeded (mulberry32), so particles are deterministic.
6. Sound: continuous layers follow `scene` every frame; one-shot cues fire when
   the playhead crosses their time while playing forward. Scrubbing is silent.
7. Assets are procedural (feTurbulence paper/stone, canvas-drawn textures),
   so pages are single self-contained files.
8. A debug UI ships with every piece: play/pause, scrubber, and timeline lanes
   generated from the same `tracks` array, so the diagram can't drift from the code.

## How I want you to work
- Present a plan or proposed change before implementing it, and wait for my OK.
- Explain the reasoning behind changes in an educational way: I'm learning
  how this works, not just collecting output.
- After a visual change, check it yourself: serve the page locally, render
  frames at specific times (e.g. with Playwright) and look at the screenshots
  before telling me it's done.

## Known gaps
- dungeon-roller-v2.html was never rendered and checked when it was written
  (the build environment couldn't download Three.js or Tone.js). Verify it
  visually and by ear before building on it.
