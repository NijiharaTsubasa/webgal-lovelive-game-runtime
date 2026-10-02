// These names were checked against all 30 ordinary LLAS face dictionaries,
// their vertex deltas, and the original clip bindings. Bind source channels
// directly so parameter expressions do not consume emotional pose recipes.
const CHANNELS = {
  eye: {
    label: 'Eye_Around',
    native: /^EyeBlendShape\.eye_facial_\d+(?:_\d+)*$/,
    names: {
      close: 'EyeBlendShape.eye_facial_001',
      closeSmile: 'EyeBlendShape.eye_facial_005',
      wide: 'EyeBlendShape.eye_facial_004',
    },
  },
  mouth: {
    label: 'Mouth',
    native: /^MouthBlendShape\.mouth_facial_\d+(?:_\d+)*$/,
    names: {
      opening: 'MouthBlendShape.mouth_facial_001',
      rounded: 'MouthBlendShape.mouth_facial_005',
    },
  },
  leftWhiteLine: {
    label: 'LeftEyeWhiteLine',
    native: /^LeftEyeWhiteLineBlendShape\.LeftEye_LineWhite_\d+$/,
    names: {
      close: 'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_001',
      closeSmile: 'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_002',
    },
  },
  rightWhiteLine: {
    label: 'RightEyeWhiteLine',
    native: /^RightEyeWhiteLineBlendShape\.RightEye_LineWhite_\d+$/,
    names: {
      close: 'RightEyeWhiteLineBlendShape.RightEye_LineWhite_001',
      closeSmile: 'RightEyeWhiteLineBlendShape.RightEye_LineWhite_002',
    },
  },
};

function bindMeshChannels(mesh, definition) {
  const geometry = mesh?.geometry;
  const count = geometry?.attributes.position?.count;
  if (!geometry?.morphTargetsRelative || !Number.isInteger(count)) {
    throw new Error(`LLAS ${definition.label}: expected relative Morph geometry`);
  }

  const dictionary = mesh.morphTargetDictionary ?? {};
  const indices = {};
  for (const [channel, name] of Object.entries(definition.names)) {
    const index = Object.hasOwn(dictionary, name) ? dictionary[name] : undefined;
    const attribute = geometry.morphAttributes.position?.[index];
    if (!Number.isInteger(index) || index < 0 || !attribute) {
      throw new Error(`LLAS ${definition.label}: missing required Morph ${name}`);
    }
    if (attribute.itemSize !== 3 || attribute.count !== count) {
      throw new Error(`LLAS ${definition.label}: invalid position Morph ${name}`);
    }
    indices[channel] = index;
  }

  // Include split and extra native channels, including Rin's authored shapes,
  // so external expressions can release every native facial contribution.
  // Derived parameter channels and unrelated application Morphs stay separate.
  const ownedIndices = [
    ...new Set(
      Object.entries(dictionary)
        .filter(([name]) => definition.native.test(name))
        .map(([, index]) => index)
    ),
  ].sort((a, b) => a - b);

  function vector(channel, kind = 'position') {
    if (kind !== 'position' && kind !== 'normal') {
      throw new Error(`LLAS ${definition.label}: unsupported Morph attribute ${kind}`);
    }
    const result = new Float32Array(count * 3);
    // All 30 neutral eye shapes and closed-mouth baselines have zero position
    // deltas. Rin's split 003/006/011 channels are zero as well.
    if (channel === 'neutral') return result;
    if (!Object.hasOwn(indices, channel)) {
      throw new Error(`LLAS ${definition.label}: unknown bound channel ${channel}`);
    }

    const attribute = geometry.morphAttributes[kind]?.[indices[channel]];
    // Position-only source assets retain the base normals.
    if (!attribute && kind === 'normal') return result;
    if (!attribute || attribute.itemSize !== 3 || attribute.count !== count) {
      throw new Error(
        `LLAS ${definition.label}: invalid ${kind} Morph ${definition.names[channel]}`
      );
    }
    for (let i = 0; i < count; i++) {
      result[i * 3] = attribute.getX(i);
      result[i * 3 + 1] = attribute.getY(i);
      result[i * 3 + 2] = attribute.getZ(i);
    }
    return result;
  }

  return {
    mesh,
    indices: Object.freeze(indices),
    ownedIndices: Object.freeze(ownedIndices),
    vector,
  };
}

export function bindLlasFaceChannels({ eyeMesh, mouthMesh, leftWhiteLine, rightWhiteLine }) {
  return {
    eye: bindMeshChannels(eyeMesh, CHANNELS.eye),
    mouth: bindMeshChannels(mouthMesh, CHANNELS.mouth),
    leftWhiteLine: bindMeshChannels(leftWhiteLine, CHANNELS.leftWhiteLine),
    rightWhiteLine: bindMeshChannels(rightWhiteLine, CHANNELS.rightWhiteLine),
  };
}
