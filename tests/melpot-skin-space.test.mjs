import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

test('MELPOT spherical correction consumes the deformed vertex in both binding representations', async () => {
  const source = readFileSync(new URL('../packages/hasunosora_runtime/shaders/melpot-toon.glsl', import.meta.url), 'utf8');
  const section = name => source.match(new RegExp(`// @section ${name}\\s+([\\s\\S]*?)// @end`))[1];
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const results = await page.evaluate(({ prelude, normal, skin }) => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) throw new Error('WebGL2 required');
      const compile = (type, source) => {
        const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };
      const vertex = `#version 300 es
precision highp float;
#define varying out
#define USE_TANGENT
uniform mat4 modelMatrix;
uniform mat4 skinMatrix;
uniform vec3 morphDelta;
in vec3 position;
${prelude}
void main() {
 vec3 objectNormal = vec3(0.0, 1.0, 0.0);
 vec3 objectTangent = vec3(1.0, 0.0, 0.0);
 vec4 tangent = vec4(objectTangent, 1.0);
 ${normal}
 vec3 transformed = (skinMatrix * vec4(position + morphDelta, 1.0)).xyz;
 ${skin}
 gl_Position = vec4(transformed, 1.0);
}`;
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.0);}'));
      gl.transformFeedbackVaryings(program, ['vMelpotSphericalNormal', 'vMelpotWorldPos'], gl.INTERLEAVED_ATTRIBS);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelMatrix'), false, identity);
      gl.uniform3f(gl.getUniformLocation(program, 'uSphericalNormalCorrectOrigin'), .1, 0, -.2);
      gl.uniform1f(gl.getUniformLocation(program, 'uSphericalNormalCorrect'), .7);
      gl.uniform3f(gl.getUniformLocation(program, 'morphDelta'), .03, -.02, .04);
      const feedback = gl.createBuffer(); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, feedback);
      gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, 24, gl.DYNAMIC_READ);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, feedback);
      gl.enable(gl.RASTERIZER_DISCARD);
      const run = (position, translation) => {
        const matrix = [...identity]; matrix.splice(12, 3, ...translation);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'skinMatrix'), false, matrix);
        gl.vertexAttrib3fv(gl.getAttribLocation(program, 'position'), position);
        gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, 1); gl.endTransformFeedback();
        const result = new Float32Array(6); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, result);
        return [...result];
      };
      return { raw: run([.2,.3,.4], [.4,0,-.3]), relocated: run([.6,.3,.1], [0,0,0]), error: gl.getError() };
    }, { prelude: section('VERTEX_PRELUDE'), normal: section('VERTEX_SKINNORMAL'), skin: section('VERTEX_SKINNING') });
    assert.equal(results.error, 0);
    const radial = [.63 - .1, .14 + .2], length = Math.hypot(...radial);
    const expected = [.7 * radial[0] / length, .3, .7 * radial[1] / length, .63, .28, .14];
    for (const representation of ['raw', 'relocated']) {
      results[representation].forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-5,
        `${representation}[${i}] ${v} != ${expected[i]}`));
    }
  } finally { await browser.close(); }
});
