# Garupa 体型数据接口

`Garupa.AvatarScaler` 根据头部提供的角色体型调整身体。它是当前包的游戏专属实现，不是通用模型参数系统；现有实现的还原状态仍以仓库 README 为准。

## 1. 声明位置与 profile

body component 的 `behaviors` 声明：

```json
{"name":"Garupa.AvatarScaler","required":true,"parameters":{"binding":{}}}
```

head component 的同名声明使用 `parameters.profile`。组合中存在 head 声明时采用它的 profile，否则采用 body 的 `binding.profile`。`binding.useScaling` 为 false 时不执行体型调整。

| profile 字段 | 含义 / 缺省值 |
| --- | --- |
| `height` | 角色身高，米，正数；以 1.55 米为缩放基准 |
| `breastSize` | 原胸围参数，缺省 50；不是米或 Morph 权重 |
| `legSpacing`、`headScaling`、`hipScaling`、`shoulderSpacing` | 对应体型倍率，缺省 1 |
| `boneSettings` | 按部位名匹配身体 `boneParts` 的调整列表，缺省空数组 |
| `boneSettings[].name` | 部位名，同 profile 内不重复 |
| `heightInfluence`、`length`、`thickness` | 该部位的身高影响系数、长度和厚度参数；均为数值 |

## 2. 身体 binding

下面的节点引用均解析到 body 部件的 glTF 节点。

| 字段 | 内容 |
| --- | --- |
| `useScaling` | 是否启用原体型调整，boolean |
| `profile` | 没有头部 profile 时采用的体型配置 |
| `legSpacing`、`hipScaling`、`shoulderSpacing` | 身体自身对应倍率，缺省 1，与 profile 参数一起参与计算 |
| `upperLegs` | 左、右大腿节点名，按左右顺序两项 |
| `shoulders` | 左、右肩节点名，按左右顺序两项 |
| `shoulderFrames` | 与 shoulders 对齐的方向投影数据，见下一节 |
| `head`、`hip` | 头和髋部节点名 |
| `leftLeg` | 左大腿、左小腿、左脚三节点，供计算参考腿长 |
| `accessories` | 需随体型调整的附属节点名数组，缺省空 |
| `boneParts` | 身体部位绑定，缺省空 |
| `secondaryOffsets` | 胸围影响的额外位置/旋转绑定，缺省空 |
| `breast` | 胸围 Morph 绑定，省略时按默认值 50、最大值 `[100,100]`、空 renderers 处理 |

`boneParts[]` 含 `name`、`heightInfluence`、`length`、`thickness`，以及一一配对的 `bones`、`targets` 节点名数组。`boneFrames` 与 bones 等长；`targetFrames` 可以为空或与 targets 等长，`Feets` 部位要求后者。帧数据用于把原骨轴上的位移或非均匀缩放表达在归一化后的骨架中。

`breast` 的字段：

- `defaultValue`：身体的原胸围基准，只取 0、50、100。
- `blendShapeMax`：两端 Morph 的原百分制最大值，两个数；JS 除以 100 转为权重倍率。
- `renderers[]`：`target` 是 renderer 节点名；其子树中的 Morph Mesh 使用 `morphs` 指定的索引。
- `morphs`：两项 `{value,index}`，value 为 0/50/100 中除 defaultValue 外的两个值，index 为输出 GLB 的 Morph 索引。这里引用索引，不引用 Morph 名；重排 target 数组必须同步更新。

`secondaryOffsets[]` 含 `target`、`useRotation`、`default`、`axis`、`range`、`source` 和 `projection`。`range` 是胸围两端的两个偏移系数；JS 根据胸围插值系数得到 scalar，再计算 `default + axis * scalar`。`useRotation=false` 时结果是原 Unity 局部位置；true 时是原 Unity Euler 角，单位度，按 Unity 的 Z→X→Y 组合顺序转成旋转，再投影到输出模型。

## 3. 坐标投影数据

这里不能只把节点改名：归一化改变了关节局部轴，原游戏的局部调整值需要投影。

- `source`：原 Unity 局部 `{position:[x,y,z], rotation:[x,y,z,w], scale:[x,y,z]}`。JS 将位置 X 取反、四元数 Y/Z 取反后组成 Three 矩阵。
- `projection`：`{left:[16个数], right:[16个数]}`，均按 Three `Matrix4.fromArray` 的列主序存储。位置及 secondaryOffsets 使用 `left * sourceLocal * right` 得到归一化局部变换。
- `shoulderFrames[]`：`{sourcePosition:[x,y,z], projection:[16个数]}`。源位置保留 Unity 坐标；计算偏移时先反射 X，再用投影矩阵的线性部分变换方向。
- `boneFrames[]`、`targetFrames[]`：含上述 source 和左右 projection。缩放路径在隔离后的骨节点使用 `right⁻¹ * scaleMatrix * right`；保留完整仿射矩阵，不将可能的剪切压回 TRS。

这些帧必须与导出的归一化骨架配套生成，不能在更换 GLB 后原样套用。初始化还会隔离部分骨节点、更新 Humanoid 比例；每帧对根节点 XZ 位移和髋部 Y 位移补偿。不要在资源生成阶段再重复应用同一套体型调整。

当前转换产物可能还带有 `positionOffset`、`propPositionOffset`、`adjustOffsetRatio`、`serializedDefault` 等来源记录，但当前 JS 不读取它们；不能将它们视为已有可控制能力。实现与字段读取位置见 [avatar-scaler.js](../packages/garupa_runtime/behaviors/avatar-scaler.js)。
