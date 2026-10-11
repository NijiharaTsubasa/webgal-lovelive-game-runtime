# 幻日夜羽参数表情

`yohane_runtime/config.json` 注册 `motionGroup: "yohane"` 的参数表情适配器，入口为 `adapters/yohane-live2d-face.js`。

## 模型数据

头部网格提供相对 Morph Target `normal`、`eye_close`、`mouth_open`，以及 `smile`、`sad`、`surprise` 等脸型。`normal` 为中性基线，其权重可能包含非零位移。眼球是独立的 `eye_l` / `eye_r` 网格，名称可带角色前缀，大小写不限。头部的多个材质图元共享位置属性时，共用一套区域绑定和计算结果。

源头部网格的局部 X 轴表示左右、Z 轴表示上下。适配器在该局部坐标中处理脸部，节点原有变换负责将其带到归一化模型空间。

## 参数映射

| 参数 | 应用方式 |
| --- | --- |
| `PARAM_EYE_L_OPEN` / `PARAM_EYE_R_OPEN` | 分侧应用闭眼 Morph；大于 1 时增加惊讶眼型 |
| `PARAM_EYE_L_SMILE` / `PARAM_EYE_R_SMILE` | 缩小眼睛开度，闭眼时混合普通与笑闭眼通道 |
| `PARAM_BROW_{L,R}_{X,Y,ANGLE,FORM}` | 分侧移动、旋转眉毛及调整眉毛弯曲 |
| `PARAM_MOUTH_OPEN_Y` | 应用张口 Morph |
| `PARAM_MOUTH_FORM_01` | 调整口部宽度和嘴角曲率，保持闭口基线的唇线闭合 |
| `PARAM_MOUTH_SCALE` / `PARAM_MOUTH_FORM_Y` | 调整口部宽度和高度位置 |
| `PARAM_EYE_BALL_X` / `PARAM_EYE_BALL_Y` / `PARAM_EYE_SCALE` | 移动眼球图案、调整大小，幅度随该侧眼睛开度衰减 |
| `PARAM_EYE_HIGHLIGHT` | 有 `hilight_down` 的眼球应用该通道 |

眼睛开度映射到 `0～1.5`，笑眼、张口和高光映射到 `0～1`，眉毛、嘴形、视线和眼球大小映射到 `-1～1`。源资源中的控制量超过这些范围时使用边界值。

这是针对 BanG Dream 参数语义的近似映射。眉毛区域优先由 `eyebrow_*` 通道识别；仅提供整脸 Morph 的模型，通过三角形连通区域、原始 Morph 位移和眼口位置识别眉毛。眉毛分片与脸部皮肤共同使用连续的局部位移场，接缝处的重合顶点保持一致，周边皮肤的位移逐渐衰减。张口使用完整的原始通道；口部宽度、曲率及位置控制根据唇部与口腔连通区域确定范围，并在周围皮肤上平滑衰减。未映射的参数保留在宿主参数集合中，适配器不改变其对应视效。

机甲 `CH_yohane_scarletdelta01` 没有脸部 Morph，适配器返回空结果。

## 生命周期

每个角色实例持有独立的几何副本。适配器接管脸部时保存相关 Morph 权重，以中性基线计算参数表情；`restore()` 恢复原几何与权重，让模型自带表情或动作继续写入。`dispose()` 同时释放副本。

相同参数帧复用计算结果，只有参数变化时才更新顶点数据。角色的身体动作仍由宿主播放，表情适配器只处理脸部网格。
