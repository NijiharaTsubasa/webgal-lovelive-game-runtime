# Garupa 变换约束接口

`Garupa.TransformConstraint` 更新原模型的 Unity RotationConstraint、PositionConstraint 和 ParentConstraint。模型组件在 `behaviors` 中引用该名称，设置 `required: true`，并提供 `parameters.frames` 与 `parameters.constraints`。节点引用按声明该 Behavior 的 head 或 body 组件解析。

```json
{
  "name": "Garupa.TransformConstraint",
  "required": true,
  "parameters": {
    "frames": [
      { "node": "Parent", "parent": null, "basis": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] },
      { "node": "Auxiliary", "parent": 0, "basis": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }
    ],
    "constraints": [
      {
        "type": "rotation",
        "target": 1,
        "sources": [{ "frame": 0, "weight": 1 }],
        "weight": 1,
        "rotationAtRest": [0,0,0],
        "rotationOffset": [0,0,0],
        "axes": [true,true,true],
        "enabled": true,
        "active": true
      }
    ]
  }
}
```

## 坐标帧与头身组合

`frames[].node` 是组件的 glTF 节点名，`parent` 是源父节点对应的 frame 索引，根节点为 `null`。`basis` 是列主序矩阵 `C₀⁻¹N₀`，将归一化骨架映射回源骨架：`N(t) = C(t) · basis`。矩阵相对于模型根节点，采用 glTF 坐标系；求解时转为 Unity 坐标，再通过逆映射写回。

`eulerHint` 可选，保存源 Transform 的非零局部 Euler 提示角，单位度，缺省为 `[0,0,0]`。部分旋转轴需要它来确定保留通道对应的等价 Euler 解。

运行时通过角色的 `nodesByName` 定位来源节点，通过头身组合提供的 `nodeBindings` 跟随实际身体骨，并将绑定变换合入 basis。AvatarScaler 隔离骨骼缩放后，约束使用对应的逻辑节点。以上对象由当前渲染器的组件组合过程提供。

源世界旋转由源局部四元数沿父级组合。旋转、位置分别写入对应通道，保留其他通道和缩放。

## 约束参数

| 公共字段 | 含义 |
| --- | --- |
| `type` | `rotation`、`position` 或 `parent` |
| `target` | 目标 frame 索引 |
| `sources` | 有序源列表；每项含 `frame` 索引和原 `weight`，空引用为 `frame: null` |
| `weight` | 约束整体权重 |
| `enabled` | 原组件及所属对象层级是否启用 |
| `active` | 原约束是否激活 |

各类型的其余字段：

| 类型 | 字段 |
| --- | --- |
| `rotation` | `rotationAtRest`、`rotationOffset`：Unity 局部 Euler 角，单位度；`axes`：X/Y/Z旋转轴开关 |
| `position` | `translationAtRest`、`translationOffset`：Unity 局部位置；`axes`：X/Y/Z平移轴开关 |
| `parent` | `translationAtRest`、`rotationAtRest`；`translationAxes`、`rotationAxes`；按原 source 索引对应的 `translationOffsets[]`、`rotationOffsets[]` |

所有轴开关均为三个 boolean；Euler 按 Unity 的 Z→X→Y 顺序组合。约束列表保持源组件顺序，数据生成端应保证依赖的写入先于读取。

## 求解

旋转源跳过空引用和零权重，计算最终总权重，以首个有效源初始化，随后依序做最短弧的归一化线性插值。每步比例为该源权重除以最终总权重并限制到 `[0,1]`。旋转约束在混合结果右侧乘 offset；ParentConstraint 先给每个源右乘对应 offset，再进行混合。转为目标局部旋转后，按整体权重从静止旋转插值。

部分旋转轴在整体权重计算后处理。受约束轴采用求解结果的 ZXY Euler 分量，保留轴通过原生 SmartEuler 规则读取当前状态：选择靠近 EulerHint 的等价解，一般结果圆整到 `0.001°`，接近提示角所代表旋转时直接采用提示角。

位置源按权重相加；多源路径除以最终总权重，单源路径保留源权重。ParentConstraint 的平移 offset 由源世界旋转转换后加到源世界位置。PositionConstraint 的单一 offset 加在目标局部坐标中。两者随后按整体权重从静止位置插值，再保留未受约束的位置轴。

非正总权重采用静止值；空源列表保持当前变换。

## 更新时机

执行顺序为 `1`，在 AvatarScaler 初始化后绑定节点。动作更新后的 `LateUpdate` 读取当前状态并求解，因此能同时用于参数动作和原生3D动作。下一帧从实际写入后的状态继续，动画可在求解前更新相同节点。停用和销毁约束时，目标保持最后写入的变换。

自动回归使用 Unity 2022.3 原生组件生成的合成输入与连续帧输出，覆盖源顺序、权重、局部偏移、位置和旋转轴、Euler分支、头身绑定与生命周期。
