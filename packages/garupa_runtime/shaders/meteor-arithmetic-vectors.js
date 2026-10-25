import { meteorArithmetic as scalarMeteorArithmetic } from './meteor-arithmetic.js';

export const meteorArithmetic = scalarMeteorArithmetic + `
mediump vec2 meteor_half(vec2 value) { return value; }
mediump vec3 meteor_half(vec3 value) { return value; }
mediump vec4 meteor_half(vec4 value) { return value; }
vec2 meteor_fma32(vec2 a, vec2 b, vec2 c) { return a * b + c; }
vec3 meteor_fma32(vec3 a, vec3 b, vec3 c) { return a * b + c; }
vec4 meteor_fma32(vec4 a, vec4 b, vec4 c) { return a * b + c; }
mediump vec2 meteor_fma16(vec2 a, vec2 b, vec2 c) { return a * b + c; }
mediump vec3 meteor_fma16(vec3 a, vec3 b, vec3 c) { return a * b + c; }
mediump vec4 meteor_fma16(vec4 a, vec4 b, vec4 c) { return a * b + c; }
`;
