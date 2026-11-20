// A group holds child layers. Its opacity, offset, scale and rotation apply to all of them,
// around its anchor point (x, y). Like a <div> wrapping other elements.
export default {
  label: 'Group',
  container: true,
  props: {
    x: { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'anchor, % of width' },
    y: { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'anchor, % of height' }
  },
  paint() { /* children are painted by the renderer */ }
};
