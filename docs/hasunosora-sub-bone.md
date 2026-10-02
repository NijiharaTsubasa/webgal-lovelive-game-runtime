# 莲之空辅助骨

`Hasunosora.SubBoneController` 随关节姿势驱动辅助蒙皮骨。`hasunosora_runtime` 注册该 Behavior，`executionOrder` 为 `28020`；带有启用 controller 的 integrated 模型以 `required: true` 声明依赖。

模型的 Behavior `parameters` 包含 `frames` 和 `rules`。转换器从每款 prefab 的 controller、其 master 和同下标初始化数据生成它们。

来源 Transform 按 controller 后代的 child-index 深度优先顺序匹配。被引用的非核心节点若在 GLB 中重名，转换器使用来源 child-index 路径生成稳定唯一名，并将该名称写入 `frames`。

| 字段 | 内容 |
| --- | --- |
| `frames[].node` | 当前模型中唯一的 GLB 节点名，由 `resolveNode("integrated", name)` 解析 |
| `frames[].basis` | 列主序 4×4 矩阵 `inverse(canonicalReferenceWorld) × sourceNeutralWorld`，两项均已转换为 glTF 坐标 |
| `frames[].parent` | 需要局部读写的帧对应的来源直接父帧下标，来源根为 `null`；只作为父空间引用的帧省略此项 |
| `rules[].input` / `outputs` | 输入帧下标和输出帧下标数组 |
| `rules[].category` | Swing 为 `1`、Twist 为 `2`、Move 为 `7` |
| `rules[].magnification` | 原 master 倍率 |
| `rules[].initialMainRotation` | 来源 Unity 局部四元数 `[x,y,z,w]` |

Swing 另有 `initialMainRight` 和 `initialSubRotation`。Twist 只使用公共字段。Move 另有 `initialSubPosition`、`inputAxis`、`outputAxis`、`minAngle` 和 `maxAngle`；轴枚举为 None `0`、Forward `1`、Up `2`、Right `3`。向量和初始化四元数保留原 Unity 局部坐标，由 Behavior 的坐标桥处理手性转换。

规则依照 master 顺序执行，只读原定义的第一个 input，向所有 outputs 写入同一来源局部结果。输出必须是保留来源直接父节点、同枢轴刚性基变换的辅助骨。输入及其坐标换算依赖的辅助骨通道必须在读取前已由本帧较早规则写入。转换器和运行时对不满足依赖顺序的配置报错。

`Update` 在动画求值前恢复上次写入的通道，`LateUpdate` 在动画和表情之后、物理之前执行规则。Swing/Twist 只接管旋转，Move 只接管位置。恢复使用当帧驱动前的值；若其他写入者已改变该通道，则保留新值。禁用与销毁使用相同所有权判断。

Swing 使用钳制插值后的 swing 分量，Twist 使用非钳制 twist 插值；两者均按来源 Slerp 的 `abs(dot) >= float(0.95)` 分支采用归一化线性插值。Move 使用 Unity 的 Euler order 4、DeltaAngle 和原角区间偏移。实现保留正负 180° 的正侧分支及角度输出的 float 舍入；JavaScript 三角函数和矩阵运算使用双精度，不承诺与 native 运算逐位一致。
