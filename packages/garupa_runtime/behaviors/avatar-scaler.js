const BASE_HEIGHT = 1.55;

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Garupa.AvatarScaler ${label} 必须是对象`);
  }
  return value;
}

function finite(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`Garupa.AvatarScaler ${label} 必须是有限数`);
  }
  return value;
}

function finiteOr(value, fallback, label) {
  return value === undefined ? fallback : finite(value, label);
}

function names(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)
      || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`Garupa.AvatarScaler ${label} 必须是非空节点名数组`);
  }
  return value;
}

function named(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Garupa.AvatarScaler ${label} 必须是非空节点名`);
  }
  return value;
}

function uniformScale(node, value) {
  node.scale.set(value, value, value);
}

function distance(left, right, scratchLeft, scratchRight) {
  left.getWorldPosition(scratchLeft);
  right.getWorldPosition(scratchRight);
  return scratchLeft.distanceTo(scratchRight);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function breastBlendWeights(value, defaultValue, maximum) {
  const [lower, upper] = breastFactors(value, defaultValue);
  const scale = maximum[value < 50 ? 0 : 1] / 100;
  return [lower * scale, upper * scale];
}

function breastFactors(value, defaultValue) {
  let lower;
  let upper;
  if (defaultValue === 0) {
    upper = clamp01((value - 50) / 50);
    lower = clamp01(value / 50) - upper;
  } else if (defaultValue === 50) {
    lower = clamp01((50 - value) / 50);
    upper = clamp01((value - 50) / 50);
  } else {
    lower = clamp01((50 - value) / 50);
    upper = clamp01((100 - value) / 50) - lower;
  }
  return [lower, upper];
}

function unityQuaternionFromEuler(THREE, eulerDegrees) {
  const [x, y, z] = eulerDegrees.map((value) => value * Math.PI / 360);
  const qx = new THREE.Quaternion(Math.sin(x), 0, 0, Math.cos(x));
  const qy = new THREE.Quaternion(0, Math.sin(y), 0, Math.cos(y));
  const qz = new THREE.Quaternion(0, 0, Math.sin(z), Math.cos(z));
  return qy.multiply(qx).multiply(qz);
}

export default class AvatarScaler {
  constructor(context, declarations) {
    this.context = context;
    const byRole = new Map(declarations.map((entry) => [entry.role, entry.parameters]));
    if (!byRole.has("body") || declarations.some((entry) => !["head", "body"].includes(entry.role))) {
      throw new Error("Garupa.AvatarScaler 至少需要 body 角色声明");
    }
    this.binding = object(object(byRole.get("body"), "body parameters").binding, "binding");
    const profile = byRole.has("head")
      ? object(byRole.get("head"), "head parameters").profile
      : this.binding.profile;
    this.profile = object(profile, "profile");
    if (typeof this.binding.useScaling !== "boolean") {
      throw new Error("Garupa.AvatarScaler binding.useScaling 必须是 boolean");
    }
    this.isolations = new WeakMap();
    this.compensated = false;
  }
  
  Awake() {
    if (!this.binding.useScaling) return;
    const profile = this.validateProfile();
    const binding = this.validateBinding();
    const resolved = this.resolveAll(binding);
    const rate = profile.height / BASE_HEIGHT;
    const inverseRate = 1 / rate;
    const heightDifference = profile.height - BASE_HEIGHT;
    const scaleParameter = (value) => value > 0 ? value * rate : Math.abs(value) * inverseRate;
    const profileParts = new Map(profile.boneSettings.map((part) => [part.name, part]));
    const boneWorldPosition = new this.context.THREE.Vector3();
    const targetWorldPosition = new this.context.THREE.Vector3();
    this.context.root.updateMatrixWorld(true);
    const oldLegLength = distance(
      resolved.leftLeg[0], resolved.leftLeg[1], boneWorldPosition, targetWorldPosition,
    ) + distance(
      resolved.leftLeg[1], resolved.leftLeg[2], boneWorldPosition, targetWorldPosition,
    );

    for (const part of resolved.boneParts) {
      const override = profileParts.get(part.name);
      const influence = override?.heightInfluence ?? part.heightInfluence;
      const length = part.length * (override?.length ?? 1);
      const thickness = part.thickness * (override?.thickness ?? 1);
      for (let index = 0; index < part.targets.length; index += 1) {
        const bone = part.bones[index];
        const target = part.targets[index];
        bone.getWorldPosition(boneWorldPosition);
        target.getWorldPosition(targetWorldPosition);
        const baseLength = boneWorldPosition.distanceTo(targetWorldPosition);
        const targetLength = baseLength + heightDifference * influence;
        if (part.name === "Feets") {
          const frame = part.targetFrames[index];
          const sourcePosition = [...frame.source.position];
          const mainSquared = targetLength * targetLength - sourcePosition[1] ** 2;
          sourcePosition[0] = -Math.sqrt(mainSquared);
          this.applySourcePosition(target, frame, sourcePosition);
        } else {
          target.position.multiplyScalar(targetLength / baseLength);
        }
        if (length !== 0 || thickness !== 0) {
          this.isolateBone(bone);
          const sourceScale = [
            scaleParameter(length),
            scaleParameter(thickness),
            scaleParameter(thickness),
          ];
          const frame = part.boneFrames[index];
          this.applySourceScale(bone, frame, sourceScale);
        }
      }
    }

    const legFactor = rate * binding.legSpacing * profile.legSpacing;
    for (const node of resolved.upperLegs) node.position.x *= legFactor;
    const shoulderFactor = rate * binding.shoulderSpacing * profile.shoulderSpacing;
    for (let index = 0; index < resolved.shoulders.length; index += 1) {
      const node = resolved.shoulders[index];
      const frame = binding.shoulderFrames[index];
      // Unity changes only source localPosition.x. Project that direction
      // through the zero-muscle parent frame without moving the base origin.
      const sourceDelta = new this.context.THREE.Vector3(
        -frame.sourcePosition[0] * (shoulderFactor - 1), 0, 0,
      );
      sourceDelta.applyMatrix3(
        new this.context.THREE.Matrix3().setFromMatrix4(frame.projection),
      );
      node.position.add(sourceDelta);
    }
    uniformScale(resolved.head, 1 + (rate - 1) * profile.headScaling);

    const hipFactor = rate * binding.hipScaling * profile.hipScaling;
    this.context.root.updateMatrixWorld(true);
    const newLegLength = distance(
      resolved.leftLeg[0], resolved.leftLeg[1], boneWorldPosition, targetWorldPosition,
    ) + distance(
      resolved.leftLeg[1], resolved.leftLeg[2], boneWorldPosition, targetWorldPosition,
    );
    resolved.hip.position.y += newLegLength - oldLegLength;

    let runtimeHips = resolved.hip;
    if (binding.hipScaling * profile.hipScaling !== 0) {
      runtimeHips = this.isolateBone(resolved.hip);
      uniformScale(resolved.hip, hipFactor);
    }
    for (const accessory of resolved.accessories) {
      accessory.position.multiplyScalar(rate);
      uniformScale(accessory, rate);
    }
    const breastWeights = breastBlendWeights(
      profile.breastSize,
      resolved.breast.defaultValue,
      resolved.breast.blendShapeMax,
    );
    const morphValues = [0, 50, 100].filter(
      (value) => value !== resolved.breast.defaultValue,
    );
    const weightByValue = new Map(morphValues.map((value, index) => [value, breastWeights[index]]));
    for (const renderer of resolved.breast.renderers) {
      for (const morph of renderer.morphs) {
        for (const target of renderer.targets) {
          target.morphTargetInfluences[morph.index] = weightByValue.get(morph.value);
        }
      }
    }
    for (const offset of resolved.secondaryOffsets) {
      const [lower, upper] = breastFactors(profile.breastSize, resolved.breast.defaultValue);
      const maximum = resolved.breast.blendShapeMax[profile.breastSize < 50 ? 0 : 1] / 100;
      const scalar = (offset.range[0] * lower + offset.range[1] * upper) * maximum;
      const value = offset.default.map((component, index) => (
        component + offset.axis[index] * scalar
      ));
      const sourcePosition = offset.useRotation ? offset.source.position : value;
      const unityRotation = offset.useRotation
        ? unityQuaternionFromEuler(this.context.THREE, value).toArray()
        : offset.source.rotation;
      const sourceLocal = new this.context.THREE.Matrix4().compose(
        new this.context.THREE.Vector3(-sourcePosition[0], sourcePosition[1], sourcePosition[2]),
        new this.context.THREE.Quaternion(
          unityRotation[0], -unityRotation[1], -unityRotation[2], unityRotation[3],
        ),
        new this.context.THREE.Vector3().fromArray(offset.source.scale),
      );
      const canonicalLocal = offset.projectionLeft.clone()
        .multiply(sourceLocal)
        .multiply(offset.projectionRight);
      const projectedPosition = new this.context.THREE.Vector3();
      const projectedRotation = new this.context.THREE.Quaternion();
      canonicalLocal.decompose(
        projectedPosition,
        projectedRotation,
        new this.context.THREE.Vector3(),
      );
      if (offset.useRotation) {
        offset.target.quaternion.copy(projectedRotation);
      } else {
        offset.target.position.copy(projectedPosition);
      }
    }

    this.rate = rate;
    this.inverseRate = inverseRate;
    this.hips = runtimeHips;
    this.hipsReference = runtimeHips.position.clone();
    this.context.setHumanoidScale(this.context.getHumanoidScale() * rate);
    this.context.root.updateMatrixWorld(true);
  }

  Update() {
    if (!this.compensated) return;
    this.context.root.position.x *= this.rate;
    this.context.root.position.z *= this.rate;
    this.restoreDisplacement(this.hips.position, this.hipsReference, ["y"]);
    this.compensated = false;
  }

  LateUpdate() {
    if (!this.binding.useScaling) return;
    this.context.root.position.x *= this.inverseRate;
    this.context.root.position.z *= this.inverseRate;
    this.compensateDisplacement(this.hips.position, this.hipsReference, ["y"]);
    this.compensated = true;
    this.context.root.updateMatrixWorld(true);
  }

  compensateDisplacement(position, reference, axes) {
    for (const axis of axes) {
      position[axis] = reference[axis] + (position[axis] - reference[axis]) * this.inverseRate;
    }
  }

  restoreDisplacement(position, reference, axes) {
    for (const axis of axes) {
      position[axis] = reference[axis] + (position[axis] - reference[axis]) * this.rate;
    }
  }

  applySourcePosition(node, frame, position) {
    const source = frame.source;
    const sourceLocal = new this.context.THREE.Matrix4().compose(
      new this.context.THREE.Vector3(-position[0], position[1], position[2]),
      new this.context.THREE.Quaternion(
        source.rotation[0], -source.rotation[1], -source.rotation[2], source.rotation[3],
      ),
      new this.context.THREE.Vector3().fromArray(source.scale),
    );
    node.position.setFromMatrixPosition(
      frame.projectionLeft.clone().multiply(sourceLocal).multiply(frame.projectionRight),
    );
  }

  applySourceScale(node, frame, scale) {
    // IsolateBone leaves the skinned bone as a child of the logical wrapper.
    // At that seam the exact canonical delta is R^-1 * sourceScale * R.
    // Keep the full affine matrix because a non-uniform conjugation may shear.
    const sourceScale = new this.context.THREE.Matrix4().makeScale(...scale);
    node.matrix.copy(
      frame.projectionRight.clone().invert()
        .multiply(sourceScale)
        .multiply(frame.projectionRight),
    );
    node.matrixAutoUpdate = false;
    node.matrixWorldNeedsUpdate = true;
  }

  isolateBone(node) {
    if (this.isolations.has(node)) return this.isolations.get(node);
    const parent = node.parent;
    if (!parent) throw new Error(`Garupa.AvatarScaler 无法隔离根节点 ${node.name}`);
    const wrapper = new this.context.THREE.Object3D();
    const originalName = node.name;
    const bodyNodes = this.context.parts
      ?.find((part) => part.role === "body")
      ?.nodesByName;
    if (bodyNodes instanceof Map) {
      const originalMatches = bodyNodes.get(originalName) || [];
      const renamedMatches = bodyNodes.get(`${originalName}$AvatarScalerScaled`) || [];
      if (originalMatches.length !== 1 || originalMatches[0] !== node || renamedMatches.length) {
        throw new Error(`Garupa.AvatarScaler 无法重映射隔离节点 ${originalName}`);
      }
    }
    node.name = `${originalName}$AvatarScalerScaled`;
    node.userData.name = node.name;
    wrapper.name = originalName;
    wrapper.userData.name = originalName;
    parent.add(wrapper);
    wrapper.position.copy(node.position);
    wrapper.quaternion.copy(node.quaternion);
    wrapper.scale.copy(node.scale);
    wrapper.updateMatrixWorld(true);
    for (const child of [...node.children]) wrapper.attach(child);
    wrapper.attach(node);
    if (bodyNodes instanceof Map) {
      bodyNodes.set(originalName, [wrapper]);
      bodyNodes.set(node.name, [node]);
    }
    this.isolations.set(node, wrapper);
    return wrapper;
  }

  validateProfile() {
    const source = this.profile;
    const boneSettings = source.boneSettings ?? [];
    if (!Array.isArray(boneSettings)) {
      throw new Error("Garupa.AvatarScaler profile.boneSettings 必须是数组");
    }
    const seen = new Set();
    const breastSize = finiteOr(source.breastSize, 50, "profile.breastSize");
    const height = finite(source.height, "profile.height");
    if (!(height > 0)) {
      throw new Error("Garupa.AvatarScaler profile.height 必须大于 0");
    }
    return {
      height,
      breastSize,
      legSpacing: finiteOr(source.legSpacing, 1, "profile.legSpacing"),
      headScaling: finiteOr(source.headScaling, 1, "profile.headScaling"),
      hipScaling: finiteOr(source.hipScaling, 1, "profile.hipScaling"),
      shoulderSpacing: finiteOr(source.shoulderSpacing, 1, "profile.shoulderSpacing"),
      boneSettings: boneSettings.map((raw, index) => {
        const item = object(raw, `profile.boneSettings[${index}]`);
        if (typeof item.name !== "string" || !item.name || seen.has(item.name)) {
          throw new Error(`Garupa.AvatarScaler profile.boneSettings[${index}].name 无效或重复`);
        }
        seen.add(item.name);
        return {
          name: item.name,
          heightInfluence: finite(item.heightInfluence, `${item.name}.heightInfluence`),
          length: finite(item.length, `${item.name}.length`),
          thickness: finite(item.thickness, `${item.name}.thickness`),
        };
      }),
    };
  }

  validateBinding() {
    const source = this.binding;
    const boneParts = source.boneParts ?? [];
    if (!Array.isArray(boneParts)) {
      throw new Error("Garupa.AvatarScaler binding.boneParts 必须是数组");
    }
    const leftLeg = names(source.leftLeg, "binding.leftLeg");
    if (leftLeg.length !== 3) {
      throw new Error("Garupa.AvatarScaler binding.leftLeg 必须依次包含三段左腿节点");
    }
    const upperLegs = names(source.upperLegs, "binding.upperLegs");
    const shoulders = names(source.shoulders, "binding.shoulders");
    if (upperLegs.length !== 2 || shoulders.length !== 2) {
      throw new Error("Garupa.AvatarScaler binding.upperLegs/shoulders 必须各包含左右两个节点");
    }
    const secondaryOffsets = source.secondaryOffsets ?? [];
    if (!Array.isArray(secondaryOffsets)) {
      throw new Error("Garupa.AvatarScaler binding.secondaryOffsets 必须是数组");
    }
    const positionFrame = (raw, label) => {
      const frame = object(raw, label);
      const sourceTransform = object(frame.source, `${label}.source`);
      const projection = object(frame.projection, `${label}.projection`);
      const vector = (value, size, vectorLabel) => {
        if (!Array.isArray(value) || value.length !== size
            || value.some((component) => !Number.isFinite(component))) {
          throw new Error(`Garupa.AvatarScaler ${vectorLabel} 无效`);
        }
        return [...value];
      };
      return {
        source: {
          position: vector(sourceTransform.position, 3, `${label}.source.position`),
          rotation: vector(sourceTransform.rotation, 4, `${label}.source.rotation`),
          scale: vector(sourceTransform.scale, 3, `${label}.source.scale`),
        },
        projectionLeft: new this.context.THREE.Matrix4().fromArray(
          vector(projection.left, 16, `${label}.projection.left`),
        ),
        projectionRight: new this.context.THREE.Matrix4().fromArray(
          vector(projection.right, 16, `${label}.projection.right`),
        ),
      };
    };
    const alignedFrames = (value, targets, label, required = false) => {
      const frames = value ?? [];
      if (!Array.isArray(frames)
          || (required ? frames.length !== targets.length
            : (frames.length !== 0 && frames.length !== targets.length))) {
        throw new Error(`Garupa.AvatarScaler ${label} 数量无效`);
      }
      return frames.map((frame, index) => positionFrame(frame, `${label}[${index}]`));
    };
    const alignedDirectionFrames = (value, targets, label) => {
      const frames = value ?? [];
      if (!Array.isArray(frames) || frames.length !== targets.length) {
        throw new Error(`Garupa.AvatarScaler ${label} 数量无效`);
      }
      return frames.map((raw, index) => {
        const frameLabel = `${label}[${index}]`;
        const frame = object(raw, frameLabel);
        const vector = (candidate, size, vectorLabel) => {
          if (!Array.isArray(candidate) || candidate.length !== size
              || candidate.some((component) => !Number.isFinite(component))) {
            throw new Error(`Garupa.AvatarScaler ${vectorLabel} 无效`);
          }
          return [...candidate];
        };
        return {
          sourcePosition: vector(frame.sourcePosition, 3, `${frameLabel}.sourcePosition`),
          projection: new this.context.THREE.Matrix4().fromArray(
            vector(frame.projection, 16, `${frameLabel}.projection`),
          ),
        };
      });
    };
    const rawBreast = source.breast ?? {
      defaultValue: 50,
      blendShapeMax: [100, 100],
      renderers: [],
    };
    const breast = object(rawBreast, "binding.breast");
    if (![0, 50, 100].includes(breast.defaultValue)) {
      throw new Error("Garupa.AvatarScaler binding.breast.defaultValue 必须是 0、50 或 100");
    }
    if (!Array.isArray(breast.blendShapeMax) || breast.blendShapeMax.length !== 2
        || breast.blendShapeMax.some((value) => !Number.isFinite(value))) {
      throw new Error("Garupa.AvatarScaler binding.breast.blendShapeMax 必须是两个有限数");
    }
    if (!Array.isArray(breast.renderers)) {
      throw new Error("Garupa.AvatarScaler binding.breast.renderers 必须是数组");
    }
    return {
      useScaling: source.useScaling,
      legSpacing: finiteOr(source.legSpacing, 1, "binding.legSpacing"),
      hipScaling: finiteOr(source.hipScaling, 1, "binding.hipScaling"),
      shoulderSpacing: finiteOr(source.shoulderSpacing, 1, "binding.shoulderSpacing"),
      upperLegs,
      shoulders,
      shoulderFrames: alignedDirectionFrames(
        source.shoulderFrames, shoulders, "binding.shoulderFrames",
      ),
      head: named(source.head, "binding.head"),
      hip: named(source.hip, "binding.hip"),
      leftLeg,
      accessories: names(source.accessories, "binding.accessories"),
      breast: {
        defaultValue: breast.defaultValue,
        blendShapeMax: [...breast.blendShapeMax],
        renderers: breast.renderers.map((raw, index) => {
          const item = object(raw, `binding.breast.renderers[${index}]`);
          if (!Array.isArray(item.morphs) || item.morphs.length !== 2) {
            throw new Error(`Garupa.AvatarScaler breast renderers[${index}].morphs 无效`);
          }
          const morphs = item.morphs.map((rawMorph, morphIndex) => {
            const morph = object(rawMorph, `binding.breast.renderers[${index}].morphs[${morphIndex}]`);
            if (![0, 50, 100].includes(morph.value) || morph.value === breast.defaultValue
                || !Number.isInteger(morph.index) || morph.index < 0) {
              throw new Error(`Garupa.AvatarScaler breast renderers[${index}].morphs 无效`);
            }
            return { value: morph.value, index: morph.index };
          });
          if (new Set(morphs.map((morph) => morph.value)).size !== 2
              || new Set(morphs.map((morph) => morph.index)).size !== 2) {
            throw new Error(`Garupa.AvatarScaler breast renderers[${index}].morphs 无效`);
          }
          return {
            target: named(item.target, `binding.breast.renderers[${index}].target`),
            morphs,
          };
        }),
      },
      secondaryOffsets: secondaryOffsets.map((raw, index) => {
        const item = object(raw, `binding.secondaryOffsets[${index}]`);
        if (typeof item.useRotation !== "boolean") {
          throw new Error(`Garupa.AvatarScaler secondaryOffsets[${index}].useRotation 必须是 boolean`);
        }
        const vector = (value, name, size) => {
          if (!Array.isArray(value) || value.length !== size
              || value.some((component) => !Number.isFinite(component))) {
            throw new Error(`Garupa.AvatarScaler secondaryOffsets[${index}].${name} 无效`);
          }
          return [...value];
        };
        const sourceTransform = object(
          item.source,
          `binding.secondaryOffsets[${index}].source`,
        );
        const projection = object(
          item.projection,
          `binding.secondaryOffsets[${index}].projection`,
        );
        return {
          target: named(item.target, `binding.secondaryOffsets[${index}].target`),
          useRotation: item.useRotation,
          default: vector(item.default, "default", 3),
          axis: vector(item.axis, "axis", 3),
          range: vector(item.range, "range", 2),
          source: {
            position: vector(sourceTransform.position, "source.position", 3),
            rotation: vector(sourceTransform.rotation, "source.rotation", 4),
            scale: vector(sourceTransform.scale, "source.scale", 3),
          },
          projectionLeft: new this.context.THREE.Matrix4().fromArray(
            vector(projection.left, "projection.left", 16),
          ),
          projectionRight: new this.context.THREE.Matrix4().fromArray(
            vector(projection.right, "projection.right", 16),
          ),
        };
      }),
      boneParts: boneParts.map((raw, index) => {
        const item = object(raw, `binding.boneParts[${index}]`);
        const bones = names(item.bones, `${item.name}.bones`);
        const targets = names(item.targets, `${item.name}.targets`);
        if (typeof item.name !== "string" || !item.name || bones.length !== targets.length) {
          throw new Error(`Garupa.AvatarScaler binding.boneParts[${index}] 名称或配对无效`);
        }
        return {
          name: item.name,
          heightInfluence: finite(item.heightInfluence, `${item.name}.heightInfluence`),
          length: finite(item.length, `${item.name}.length`),
          thickness: finite(item.thickness, `${item.name}.thickness`),
          bones,
          targets,
          boneFrames: alignedFrames(
            item.boneFrames, bones, `${item.name}.boneFrames`, true,
          ),
          targetFrames: alignedFrames(
            item.targetFrames, targets, `${item.name}.targetFrames`, item.name === "Feets",
          ),
        };
      }),
    };
  }

  resolveAll(binding) {
    const resolve = (name) => this.context.resolveNode("body", name);
    const breast = {
      ...binding.breast,
      renderers: binding.breast.renderers.map((item) => {
        const target = resolve(item.target);
        const targets = [];
        target.traverse((object) => {
          if (Array.isArray(object.morphTargetInfluences)) targets.push(object);
        });
        if (!targets.length || targets.some((object) =>
          item.morphs.some((morph) => morph.index >= object.morphTargetInfluences.length))) {
          throw new Error(`Garupa.AvatarScaler breast renderer ${item.target} 的 morph 绑定无效`);
        }
        return { ...item, targets };
      }),
    };
    return {
      upperLegs: binding.upperLegs.map(resolve),
      shoulders: binding.shoulders.map(resolve),
      head: resolve(binding.head),
      hip: resolve(binding.hip),
      leftLeg: binding.leftLeg.map(resolve),
      accessories: binding.accessories.map(resolve),
      breast,
      secondaryOffsets: binding.secondaryOffsets.map((item) => ({
        ...item,
        target: resolve(item.target),
      })),
      boneParts: binding.boneParts.map((part) => ({
        ...part,
        bones: part.bones.map(resolve),
        targets: part.targets.map(resolve),
      })),
    };
  }
}
