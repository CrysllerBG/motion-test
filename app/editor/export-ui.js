// The "Export video" dialog: choose size, frame rate and quality, watch progress, download.
import { exportVideo, exportSupported, QUALITY } from './exporter.js';
import { h } from './controls.js';
import { hasSound } from '../engine/audio/graph.js';

export function openExportDialog(dialog, { spec, comp, name, errors }) {
  dialog.innerHTML = '';
  const close = h('button', { class: 'btn', onclick: () => { ctrl?.abort(); dialog.close(); } }, 'Close');
  dialog.append(h('h2', { class: 'dlg-title' }, 'Export video'));
  if (!exportSupported()) {
    dialog.append(h('p', {}, 'This browser can\'t encode video (it has no WebCodecs). Open Motion Studio in a recent Chrome, Edge or Safari.'), close);
    return dialog.showModal();
  }
  if (errors?.length) dialog.append(h('p', { class: 'warn-text' }, 'The composition has problems; fix them before exporting (see the red box under the stage).'));

  const aspect = comp.width / comp.height;
  const sizes = [[comp.width, `${comp.width}×${comp.height} (composition)`]];
  for (const w of [3840, 2560, 1920, 1280, 960, 640]) {
    const hgt = Math.round(w / aspect / 2) * 2;
    if (w !== comp.width) sizes.push([w, `${w}×${hgt}`]);
  }
  const sizeSel = h('select', {}, sizes.map(([w, l]) => h('option', { value: w }, l)));
  const fpsSel = h('select', {}, [...new Set([comp.fps, 24, 25, 30, 60])].map(f => h('option', { value: f, selected: f === comp.fps }, `${f} fps` + (f === comp.fps ? ' (composition)' : ''))));
  const qSel = h('select', {}, Object.keys(QUALITY).map(q => h('option', { value: q, selected: q === 'high' }, q)));
  const estimate = h('span', { class: 'mini' });
  const updateEstimate = () => {
    const w = +sizeSel.value, hh = w / aspect, f = +fpsSel.value;
    const mb = w * hh * f * QUALITY[qSel.value] * comp.duration / 8 / 1e6;
    estimate.textContent = `${Math.round(comp.duration * f)} frames · about ${mb < 1 ? mb.toFixed(1) : Math.round(mb)} MB (often less: still frames compress well)`;
  };
  [sizeSel, fpsSel, qSel].forEach(s => s.addEventListener('change', updateEstimate));
  updateEstimate();

  const withSound = hasSound(comp);
  const soundBox = h('input', { type: 'checkbox', checked: withSound || undefined, disabled: !withSound || undefined });
  const bar = h('progress', { max: 1, value: 0, class: 'export-progress' });
  const msg = h('p', { class: 'mini', 'aria-live': 'polite' }, 'Frames are rendered one by one at exact times, so the result matches the preview frame for frame.' + (withSound ? ' Sound is rendered separately, faster than real time, with every cue at its exact moment.' : ''));
  const go = h('button', { class: 'btn primary' }, 'Export MP4');
  let ctrl = null;

  go.onclick = async () => {
    ctrl = new AbortController();
    go.disabled = true; [sizeSel, fpsSel, qSel, soundBox].forEach(s => s.disabled = true);
    try {
      const res = await exportVideo(spec, {
        width: +sizeSel.value, fps: +fpsSel.value, quality: qSel.value, audio: soundBox.checked, signal: ctrl.signal,
        onProgress: ({ stage, frame, frames, eta }) => { bar.max = frames; bar.value = frame; msg.textContent = stage === 'sound' ? 'Rendering sound…' : `Frame ${frame} of ${frames} · about ${Math.ceil(eta)} s left`; }
      });
      const url = URL.createObjectURL(res.blob);
      const file = `${name}-${res.width}x${res.height}-${res.fps}fps.mp4`;
      const link = h('a', { href: url, download: file, class: 'btn primary' }, 'Download again');
      msg.textContent = `Done in ${res.seconds.toFixed(1)} s: ${file}, ${(res.blob.size / 1e6).toFixed(1)} MB, ${res.frames} frames, ${res.codec}` +
        (res.audio ? ` + sound (${res.audio === 'opus' ? 'Opus: plays in browsers and VLC, not QuickTime' : 'AAC'}).` : res.audioNote ? `. Note: ${res.audioNote}.` : '.');
      go.replaceWith(link);
      link.click();                     // start the download right away
    } catch (e) {
      msg.textContent = e.name === 'AbortError' ? 'Export cancelled.' : `Export failed: ${e.message}`;
      go.disabled = false; [sizeSel, fpsSel, qSel].forEach(s => s.disabled = false); soundBox.disabled = !withSound;
    }
  };

  dialog.append(
    h('div', { class: 'dlg-grid' },
      h('label', {}, 'Size'), sizeSel,
      h('label', {}, 'Frame rate'), fpsSel,
      h('label', {}, 'Quality'), qSel,
      h('label', {}, 'Sound'), h('label', { class: 'mini' }, soundBox, withSound ? ' Include sound' : ' (this composition has no sound)')),
    estimate, bar, msg,
    h('div', { class: 'btn-row dlg-actions' }, go, close));
  dialog.addEventListener('close', () => ctrl?.abort(), { once: true });
  dialog.showModal();
}
