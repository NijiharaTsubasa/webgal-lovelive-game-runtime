// Preserve source fma and half-cast expression boundaries. Native GPU floating
// arithmetic may round differently across backends; no visual approximation
// or replacement lighting formula is introduced here.
export const meteorArithmetic = `
float meteor_fma32(float a, float b, float c) { return a * b + c; }
mediump float meteor_fma16(float a, float b, float c) { return a * b + c; }
mediump float meteor_half(float value) { return value; }
`;
