# LLAS 表情数据接口

## 1. 普通脸：`LLAS.Face`

一体化模型 component 在 `behaviors` 中声明 `LLAS.Face`。`parameters.bindings` 保存原表情除 Morph 外的辅助节点属性；Morph 配方仍放在该 component 的标准 `morphPoses` 中。

```json
{
  "name": "LLAS.Face",
  "required": true,
  "parameters": {
    "bindings": [{
      "node": "LeftEye2",
      "property": "position",
      "default": [0, 0, 0],
      "poses": [{"name": "eye/Open", "value": [0, 0, 0]}]
    }]
  }
}
```

以上数值只示意结构，不是可套用到其他模型的绑定值。

| 字段 | 内容 |
| --- | --- |
| `node` | 当前 integrated 部件内的 glTF 节点名 |
| `property` | `position`、`quaternion`、`scale` 或 `visible` |
| `default` | 默认局部属性；位置/缩放为三元素数组，旋转为 `[x,y,z,w]`，显隐为 boolean |
| `poses` | 影响该属性的源表情配方列表，`name` 引用同 component 的 `morphPoses[].name` |
| `poses[].value` | TRS 属性在该源配方中的值，类型与 `default` 相同 |
| `poses[].length` | 显隐源 clip 的时长，单位秒 |
| `poses[].curve` | 显隐曲线的分段多项式数组，见下文 |

TRS 已转换为输出模型的局部坐标系；不能把原 Unity 局部值直接填入。一个节点属性只绑定一次；同一 binding 中的配方名不重复。这里的 `eye/Open` 等名字是配方名，不是供用户选择的完整表情名。

显隐的每个曲线段为 `[time,a,b,c,d]`，按 `time` 严格递增，首段从 0 开始。JS 用该配方权重 `w` 采样 `length * w`，选最后一个起点不晚于采样时间的段，再计算 `a*dt³+b*dt²+c*dt+d`。它不是随动作时间播放的表情动画。

`Face` 从 `getExpressionState('integrated').poseWeights` 读取实际配方权重。负权重按 0 处理，缺失权重为 0；各源值按权重相加，总权重不足 1 时补入默认值，超过 1 时不另行归一化。旋转按同半球累加后归一化；显隐对混合结果使用 `abs(value) > float32(0.001)`。计算保留 float32 运算语义，具体实现见 [face.js](../packages/llas_runtime/behaviors/face.js)。

每帧写入前保存原属性，下次更新先恢复，避免把上帧的临时结果累积进当前姿态。`setEnabled(false)` 也会恢复；参数表情适配器接管时宿主暂停原表情写入，退出后恢复自带表情路径。

## 2. 璃奈板：`LLAS.BoardFace`

该 Behavior 不依赖完整表情名，而是读取隐藏载体上的 Morph 权重。载体的 Morph 可以是零位移的 dummy target；在这里它们是控制信号，不是可见变形。

```json
{
  "name": "LLAS.BoardFace",
  "required": true,
  "parameters": {
    "inputNode": "BoardSignals",
    "minRateToActive": 0.5,
    "domains": [{
      "name": "eye",
      "defaults": {"EyePattern": false},
      "entries": [{
        "morph": "eyeSignal",
        "visibility": {"EyePattern": true}
      }]
    }]
  }
}
```

节点名、信号名和阈值均为结构示例，实际值来自模型配置。

| 字段 | 内容 |
| --- | --- |
| `inputNode` | 信号节点名；其子树内恰有一个带 Morph 权重和名称字典的 Mesh |
| `minRateToActive` | 信号激活阈值，范围 `(0,1]`，权重等于阈值也激活 |
| `domains` | 分别选择图案的域，例如眼和口 |
| `defaults` | 该域全部受控节点的默认显隐，键为 glTF 节点名 |
| `entries` | 有序信号列表 |
| `entries[].morph` | 信号载体中的 Morph 名 |
| `entries[].visibility` | 该信号对应的完整显隐快照，节点集合与该域 `defaults` 相同 |

域之间不能共享显隐输出，同一信号也不重复绑定。每帧各域从 defaults 开始，依次遍历 entries，达到阈值的条目覆盖前面的选择：**最后一个达标条目胜出，不是最大权重胜出**。没有达标条目时回到 defaults。初始化会隐藏输入节点；禁用或销毁时恢复各域默认显隐。

这些快照由原游戏数据和 Unity 解算结果生成，不能通过眼睛/嘴巴开合数值猜测图案。标准表情配方对信号 Morph 写权重，Behavior 再把权重翻译为显隐。

## 3. BanG Dream 参数表情适配

`llas-garupa-face` 按 `motionGroup: "llas"` 注册，入口为 `createExpressionAdapter(context)`。通用参数输入与生命周期由参数动作与表情标准定义；此处补充模型侧要求。

当前适配器要求普通脸 `LLAS.Face` 声明，璃奈板模型返回 `null`，不使用普通脸适配路径。模型需要：

- `Eye_Around`、`Mouth`、`Face`、`LeftEyeWhiteLine`、`RightEyeWhiteLine`：对应原脸部 Mesh，各自能解析为单个源 primitive。`Face` 提供眉毛深度约束所需的面部表面。
- `LeftEye_Root`、`RightEye_Root`、`LeftEye2`、`RightEye2`：用于眼球位移、缩放及局部基准测量。
- `LLAS.Face.parameters.bindings` 中的原生辅助属性绑定，供眼睛开合、笑眼和超开状态求值。
- 相对 Morph、位置及 UV 数据。适配器按实际名称字典绑定下表中的底层通道；Morph 法线可选，缺少时沿用基础法线。必要通道缺失时加载报错，已声明的零位移通道有效。

| Mesh | 底层 Morph | 用途 |
| --- | --- | --- |
| `Eye_Around` | `EyeBlendShape.eye_facial_001` | 闭眼 |
| `Eye_Around` | `EyeBlendShape.eye_facial_005` | 笑眼闭合 |
| `Eye_Around` | `EyeBlendShape.eye_facial_004` | 超开 |
| `Mouth` | `MouthBlendShape.mouth_facial_001` | A 型张嘴 |
| `Mouth` | `MouthBlendShape.mouth_facial_005` | O 型圆口 |
| `LeftEyeWhiteLine` | `LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_001`、`LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_002` | 闭眼、笑眼睫毛高光 |
| `RightEyeWhiteLine` | `RightEyeWhiteLineBlendShape.RightEye_LineWhite_001`、`RightEyeWhiteLineBlendShape.RightEye_LineWhite_002` | 闭眼、笑眼睫毛高光 |

30 个普通脸的中性眼和闭嘴基准使用基础位置，即零位置 Morph 增量。运行时根据图集与连通结构划分区域：眼睛使用底层通道在眼区的增量；眉毛使用独立平移、旋转、曲率通道，负曲率结合本模型的中性上拱幅度计算。每侧眉在完成形变后依据 `Face` 表面整体调整深度。

眼皮褶线与下方阴影随模型原生的睁闭眼、笑眼和超开形态配套变化。独立双眼皮参数 `PARAM_EYELID_L/R` 在实现过程中表现出与视觉收益不相称的复杂度；考虑到多角色同屏时的性能开销风险，暂不映射。

嘴部使用 A、O 两个底层形态，分别建立实例内形变支撑。A 分支包含宽高、位置、缩放和曲率；O 分支包含 XY 尺寸和纵向位置，口部 XY 缩放为 `0.5*min(1,scale)`。设开度为 `a`、嘴形为 `form`，圆口混合量 `r=a*max(0,-form)`；两分支在开度 `a` 下求出的完整增量分别乘 `1-r`、`r`。闭嘴曲率以本模型唇线为基准连续调整，开口时负嘴形逐渐转为小圆口。

两分支各自保留源通道保持不动的外部接缝，重合的 UV 分裂顶点共用支撑权重，独立牙齿／口腔连通片随对应口部形变。辅助眼骨继续按原生属性绑定求值，眼球围绕各自的中性中心缩放。

支持的输入包括左右眼开合/笑眼、眼球 XY/缩放、左右眉 XY/角度/曲率、嘴开合/形状/纵向调整/缩放，以及两种脸红。具体参数名和当前映射范围见 [llas-live2d-parameters.js](../packages/llas_runtime/adapters/llas-live2d-parameters.js)。这些是跨媒介标定后的近似映射，不是 LLAS 原游戏表情算法；两种脸红合并为 LLAS 双颊纹理，独立双眼皮参数 `PARAM_EYELID_L/R`、额外眼型、独立高光和眼泪未映射。超出标定范围的输入按对应边界值处理；脸红需要模型与渲染模式提供可用脸红纹理，缺少时其余面部控制仍正常生效。

适配器接管对应脸部原生通道前保存权重，再清除这些通道的贡献并应用参数结果；派生通道、辅助 TRS 和显隐也纳入同一恢复过程。Main／Outline 的权重分别写入和恢复，并共享实例内派生几何。运行时新增的 Morph 通道由它自己释放，无需写回 GLB。脸红通过 Shader 的包内接口控制，见 [Shader 数据接口](shader-data.md)。
