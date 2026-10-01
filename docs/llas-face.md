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

- `Eye_Around`、`Mouth`：对应原脸部 Mesh，各自能解析为单个源 primitive。
- `LeftEye_Root`、`RightEye_Root`、`LeftEye2`、`RightEye2`：用于眼球位移、缩放及局部基准测量。
- `morphPoses` 中的 `eye/Open`、`eye/Close`、`eye/CloseSmile`、`eye/WideOpen`、`eye/Sad`，且含 `Eye_Around` 的 Morph 配方；以及 `mouth/A`、`mouth/Sad`，且含 `Mouth` 的配方。
- 这些 Mesh 的位置、法线及 Morph 数据；适配器在加载时根据源几何划分眼、眉、眼皮、嘴部区域，构造额外变形通道，不只是混合用户可见的预组表情。

支持的输入包括左右眼开合/笑眼/眼皮、眼球 XY/缩放、左右眉 XY/角度/曲率、嘴开合/形状/纵向调整/缩放，以及两种脸红。具体参数名和当前映射范围见 [llas-live2d-parameters.js](../packages/llas_runtime/adapters/llas-live2d-parameters.js)。这些是跨媒介标定后的近似映射，不是 LLAS 原游戏表情算法；两种脸红合并为 LLAS 双颊纹理，额外眼型、独立高光和眼泪未映射。

适配器保存并恢复它接管的 Morph、辅助 TRS 和显隐。运行时新增的 Morph 通道由它自己释放，无需写回 GLB。脸红通过 Shader 的包内接口控制，见 [Shader 数据接口](shader-data.md)。
