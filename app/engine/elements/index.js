// The element registry: layer "type" in the JSON → the module that knows how to paint it.
// To add a new kind of element, write a module with { label, props, paint } and list it here.
import background from './background.js';
import group from './group.js';
import glow from './glow.js';
import text from './text.js';
import line from './line.js';
import shape from './shape.js';
import particles from './particles.js';
import noise from './noise.js';
import vignette from './vignette.js';
import d20 from './d20.js';
export { COMMON_PROPS, BLEND_OP } from './common.js';
export const ELEMENTS = { background, group, glow, text, line, shape, particles, noise, vignette, d20 };
