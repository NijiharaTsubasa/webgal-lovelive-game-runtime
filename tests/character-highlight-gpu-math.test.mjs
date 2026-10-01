import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const shader = readFileSync(new URL(
  "../packages/hasunosora_runtime/shaders/character-highlight.glsl", import.meta.url,
), "utf8");
const pattern = /\/\/ @section COMPILED_PATTERN\r?\n([\s\S]*?)\r?\n\/\/ @end/.exec(shader)?.[1];
assert.ok(pattern, "CharacterHighlight compiled pattern section missing");
const sourceRegisters = readFileSync(new URL(
  "./fixtures/compiled-shaders/characterhighlight-e001-uv.glsl", import.meta.url,
), "utf8");

const fract = (value) => value - Math.floor(value);
const hash = (x, y) => fract(Math.sin(x * 127.0999984741211
  + y * 311.70001220703125) * 43758.546875) * 2 - 1;

// Direct transcription of the retained Vulkan Forward blob1's two repeated
// hash/interpolation register groups. It does not call or parse the port.
function sourceNoise(value) {
  const cell = Math.floor(value);
  const fraction = fract(value);
  const smooth = fraction * fraction * (3 - 2 * fraction);
  const h00 = hash(cell, cell);
  const h10 = hash(cell + 1, cell);
  const h01 = hash(cell, cell + 1);
  const h11 = hash(cell + 1, cell + 1);
  const lower = 2 * h00 * fraction;
  const upper = h10 * (2 * fraction - 1);
  const first = lower + smooth * (upper - lower);
  const next = h01 * (2 * fraction - 1);
  const far = 2 * h11 * (fraction - 1);
  const second = next + smooth * (far - next);
  return first + smooth * (second - first) + 0.5;
}

function sourceUv(sample) {
  const p = sample.useCry
    ? [sample.cryWidth * 100 + 0.009999999776482582,
      sample.cryRotateFrequency * 100, sample.cryRotateWidth * 100,
      sample.cryTilingFrequency * 100]
    : [sample.normalWidth * 100, sample.normalRotateWidth * 100,
      sample.normalTilingFrequency * 100, sample.normalRotateFrequency * 100];
  const q = p.map(Math.floor);
  const oscillationA = Math.cos(q[2] * sample.time * 0.009999999776482582);
  const oscillationB = Math.cos(q[3] * sample.time * 0.009999999776482582);
  const scaleNoise = sourceNoise(oscillationA);
  const rotationNoise = sourceNoise(oscillationB);
  const baseScale = 1 - q[0] * 0.009999999776482582;
  const scale = baseScale + scaleNoise * (1 - baseScale);
  const angle = q[1] * 0.009999999776482582 * rotationNoise;
  const x = sample.uv[0] * scale - 0.5;
  const y = sample.uv[1] * scale - 0.5;
  return [x * Math.cos(angle) + y * Math.sin(angle) + 0.5,
    -x * Math.sin(angle) + y * Math.cos(angle) + 0.5];
}

const cases = [
  { uv: [0.23, 0.67], time: 0.37, useCry: 0,
    normalWidth: 0.05, normalRotateWidth: 0.02, normalTilingFrequency: 1,
    normalRotateFrequency: 7, cryWidth: 0.01, cryRotateWidth: 0.02,
    cryTilingFrequency: 5, cryRotateFrequency: 7 },
  { uv: [0.74, 0.31], time: 4.29, useCry: 0,
    normalWidth: 0.13, normalRotateWidth: 0.055, normalTilingFrequency: 2.5,
    normalRotateFrequency: 11, cryWidth: 0.025, cryRotateWidth: 0.035,
    cryTilingFrequency: 3, cryRotateFrequency: 9 },
  { uv: [0.41, 0.82], time: 2.73, useCry: 1,
    normalWidth: 0.05, normalRotateWidth: 0.02, normalTilingFrequency: 1,
    normalRotateFrequency: 7, cryWidth: 0.015, cryRotateWidth: 0.04,
    cryTilingFrequency: 4, cryRotateFrequency: 6 },
  { uv: [0.5, 0.5], time: 0, useCry: 0,
    normalWidth: 0.009999, normalRotateWidth: 0.01, normalTilingFrequency: 1,
    normalRotateFrequency: 7, cryWidth: 0.01, cryRotateWidth: 0.02,
    cryTilingFrequency: 5, cryRotateFrequency: 7 },
  { uv: [0.06, 0.94], time: 123.456, useCry: 1,
    normalWidth: 0.05, normalRotateWidth: 0.02, normalTilingFrequency: 1,
    normalRotateFrequency: 7, cryWidth: 0.009999, cryRotateWidth: 0.061,
    cryTilingFrequency: 5, cryRotateFrequency: 13 },
];

test("CharacterHighlight compiled UV agrees with source registers at non-endpoint inputs", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const observed = await page.evaluate((input) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const gl = canvas.getContext("webgl2");
      if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
        throw new Error("WebGL2 float render target required");
      }
      const compile = (type, source) => {
        const object = gl.createShader(type);
        gl.shaderSource(object, source);
        gl.compileShader(object);
        if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(object));
        }
        return object;
      };
      const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
        void main() {
          vec2 p = vec2( gl_VertexID == 1 ? 3.0 : -1.0,
            gl_VertexID == 2 ? 3.0 : -1.0 );
          gl_Position = vec4( p, 0.0, 1.0 );
        }`);
      const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
        precision highp float;
        #define texture2D(s,u) vec4((u),0.0,1.0)
        ${input.pattern}
        ${input.sourceRegisters}
        uniform vec2 uProbeUv;
        out vec4 result;
        void main() {
          result = vec4(chCompiledPattern(uProbeUv).xy, chSourceUv(uProbeUv));
        }`);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
      gl.useProgram(program);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("CharacterHighlight float framebuffer incomplete");
      }
      gl.bindVertexArray(gl.createVertexArray());
      const set = (name, value) => gl.uniform1f(gl.getUniformLocation(program, name), value);
      const outputs = [];
      for (const sample of input.cases) {
        gl.uniform2f(gl.getUniformLocation(program, "uProbeUv"), ...sample.uv);
        gl.uniform4f(gl.getUniformLocation(program, "uHighlightMainColor"), 1, 1, 1, 1);
        set("uTime", sample.time);
        set("uUseCryParameters", sample.useCry);
        set("uNormal_TilingNoiseWidth", sample.normalWidth);
        set("uNormal_RotateNoiseWidth", sample.normalRotateWidth);
        set("uNormal_TilingFrequency", sample.normalTilingFrequency);
        set("uNormal_RotateFrequency", sample.normalRotateFrequency);
        set("uCry_TilingNoiseWidth", sample.cryWidth);
        set("uCry_RotateNoiseWidth", sample.cryRotateWidth);
        set("uCry_TilingFrequency", sample.cryTilingFrequency);
        set("uCry_RotateFrequency", sample.cryRotateFrequency);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const pixel = new Float32Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
        if (gl.getError() !== gl.NO_ERROR) throw new Error("CharacterHighlight readback failed");
        outputs.push(Array.from(pixel));
      }
      return outputs;
    }, { pattern, sourceRegisters, cases });
    for (const [index, sample] of cases.entries()) {
      const expected = sourceUv(sample);
      for (let channel = 0; channel < 2; channel += 1) {
        assert.ok(Math.abs(observed[index][channel] - observed[index][channel + 2]) < 1e-5,
          `case ${index} channel ${channel}: port GPU ${observed[index][channel]}, `
          + `source-register GPU ${observed[index][channel + 2]}`);
        assert.ok(Math.abs(observed[index][channel + 2] - expected[channel]) < 0.01,
          `case ${index} channel ${channel}: source GPU ${observed[index][channel + 2]}, `
          + `source CPU ${expected[channel]}`);
      }
    }
  } finally {
    await browser.close();
  }
});
