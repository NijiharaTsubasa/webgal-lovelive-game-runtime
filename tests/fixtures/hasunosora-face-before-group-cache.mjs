// Frozen update before the two independent geometry cache groups.
import { hasunosoraFaceControls } from '../../packages/hasunosora_runtime/adapters/hasunosora-live2d-face.js';

export function originalUpdate() {
  this.beginFrame();
  const controls = hasunosoraFaceControls(this.parameters, this.defaults);
  this.underlay = [];
  for (const work of this.workspaces) {
    for (const { object } of work.objects) {
      for (const { index } of work.targets.values()) {
        this.underlay.push({ object, index, value: object.morphTargetInfluences[index] });
        object.morphTargetInfluences[index] = 0;
      }
    }
  }
  const key = JSON.stringify(controls), changed = key !== this.cacheKey;
  if (changed) {
    for (const work of this.workspaces) work.reset();
    this.applyEyes(controls.eyes);
    this.applyBrows(controls.brows);
    this.applyMouth(controls.mouth);
    this.applyGaze(controls.gaze, controls.highlight);
    for (const work of this.parts.Face)
      work.add(work.target('Other_Tear'), controls.tear);
    this.clearBrows();
    this.cacheKey = key;
  }
  for (const work of this.workspaces) work.activate(changed);
  return controls;
}
