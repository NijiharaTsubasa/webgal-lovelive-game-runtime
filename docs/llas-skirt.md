# LLAS 撑裙数据接口

`LLAS.SkirtSafe` 在 `PostPhysics` 阶段执行普通撑裙修正。模型通过 `behaviors`
引用它，`parameters.managers[]` 保存来源管理器的膝轴和裙骨参数，各组保持来源处理顺序。

| 字段 | 含义 |
| --- | --- |
| `knees[].node` | 当前 integrated 模型内的大腿节点名 |
| `knees[].right` | 来源大腿局部 +X 轴在规范节点局部空间中的表达 |
| `bones[].node`、`parent`、`child` | 裙骨、来源父节点及裙骨末端的 glTF 节点名 |
| `bones[].parentFrame` | 列主序 4×4 仿射矩阵，将来源 Unity 父节点局部坐标变换到规范父节点局部坐标，包含坐标系反射 |
| `bones[].axis` | 来源 `boneAxis` 在规范裙骨局部空间中的表达 |
| `bones[].length` | 来源初始化时裙骨至末端的世界距离，以模型长度单位计 |
| `bones[].knees` | 参与当前裙骨判定的组内 `knees[]` 索引 |
| `bones[].dotMin`、`dotMax` | 来源膝轴点积区间 |
| `bones[].rotationDegrees` | 来源父空间的最大 Y 旋转角，单位度 |
| `bones[].kneeSpaceOffset` | 当前裙骨在普通修正路径中使用的撑裙偏移 |

运行时取来源父节点 forward 与所选大腿 right 的最小点积，计算
`ratio = 1 - InverseLerp(dotMin, dotMax, minDot)`。父节点来源世界矩阵右乘
`rotationY(rotationDegrees * ratio)`，将末端变换到该空间。若其 Z 小于
`kneeSpaceOffset * ratio`，将 Z 提升到阈值、X 设置为 `-length`，归一化回 `length` 后
转回世界空间；用 `FromToRotation` 更新裙骨旋转，并设置末端世界位置。

下一步动作求值前恢复临时修改的末端局部位置。宿主在补偿后同步物理粒子状态，
防止补偿前的位置和速度在下一步重新生效。通用 `physics.collisionEdges` 负责裙骨末端
之间的连边碰撞，撑裙 Behavior 在其结果上继续执行。

算法对应 LLAS `SafeCorrect`（RVA `0x2CB3040`）、`SetupSkirtInfo`（`0x2CB2D84`）、
`SetupKneeInfo`（`0x2CB9628`）及 `UpdateSwingBonePosition`（`0x2FE8C10`）。该包启用
普通 `force=false` 路径；原游戏是否启用由场景的 `safeSwingBone` 控制。
来源缺少 `kneeSpaceOffsetFront/Other` 时，转换器使用当前游戏构造代码
`0x2CB55AC` 确认的默认值 `0.02/0.04`。
