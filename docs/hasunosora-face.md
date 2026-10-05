# 莲之空参数表情适配

`hasunosora_runtime` 中的三个 `garupa-expression-adapter` 共用 `adapters/hasunosora-live2d-face.js`，按模型的 `motionGroup` 选择 `hasunosora-face-profiles.js` 中的中性基线。各模型的实际位移来自自身的 Morph Target。

| motionGroup | 中性基线 | 角色 |
| --- | --- | --- |
| `hasunosora.kaho` | Normal 眼睑与闭口、花帆眉形配方 | 日野下花帆 |
| `hasunosora.old` | Normal 眉、眼睑与闭口配方 | 乙宗梢、夕雾缀理、藤岛慈、村野沙耶香、大泽瑠璃乃 |
| `hasunosora.new` | 基础网格 | 百生吟子、徒町小铃、安养寺姬芽、桂城泉、瑟拉斯（Ceras）、大賀美沙知、村野つかさ、大道広実、錦上マイカ、令沢葵 |

转换器通过 `input_hasunosora/CostumeModels.yaml` 的服装 ID 与 `CharactersId` 关联角色，并为主数据缺失的錦上マイカ、令沢葵提供模型 ID 映射。使用时把模型包和 `hasunosora_runtime` 放入游戏资源目录，由 Terre 扫描生成资源清单。预览器在选择对应模型后，将表情来源设为 BanG Dream 参数表情即可选择 EXP；身体动作来源可独立选择参数动作或通用 3D 动作。

## 模型数据

适配器通过标准 `resolveNode` 绑定 `Face Renderer`、`Brow Renderer`、`EyeShadow Renderer`、`Eye Renderer`，读取它们的位置属性、可用法线和相对 Morph。Eye 可仅含基础网格，其视线与大小控制直接作用于位置属性。Eye 的虹膜与高光 primitive 分别处理；高光材质使用 `character-highlight`。脸部坐标由 Head 的绑定矩阵确定，服装的局部位置与旋转由这层坐标转换吸收。

EyeShadow 表达眼皮线在眼白上的阴影，通过与 Face 配套的眼睑 Morph 跟随眼型变化。

Face 中的眼皮褶线及下方皮肤着色区域随眼型 Morph 配套形变。独立双眼皮参数 `PARAM_EYELID_L/R` 在实现过程中表现出与视觉收益不相称的复杂度；考虑到多角色同屏时的性能开销风险，暂不映射。

眼睑使用 `Eyelids_Normal`、`Eyelids_Close_L/R`、`Eyelids_SmileB_L/R`、`Eyelids_Smile`、`Eyelids_Open`，同时作用于 Face 和 EyeShadow。半开笑眼的 `Eyelids_Smile` 补充形变仅在这两类网格均具备该通道时叠加；缺失时共同使用 `Eyelids_Close_L/R` 与 `Eyelids_SmileB_L/R` 的开闭混合。嘴部以角色中性闭口为基线，使用 `Mouth_A`、`Mouth_O`、`Mouth_cornerUP_L/R`、`Mouth_cornerDown_L/R`、`Mouth_UP`、`Mouth_Down`；`Up`/`UP` 两种源名称分别绑定。缺少 `Mouth_O` 的模型保留 `Mouth_A` 张口开度，圆口形状受源模型能力限制。中性眉使用所属组的配方，独立平移、旋转和曲率在此基础上计算。

眉毛的活动网格按中性状态下的可见连通部分确定。形变后依据当前 Face 表面，为左右主眉分别计算保持眉形的整体深度避让；源模型藏于皮下的备用表情网格保留原深度。

## 参数能力

这些控制是 BanG Dream Live2D 到三维脸部的近似适配。

| 参数 | 表现 |
| --- | --- |
| `PARAM_EYE_L/R_OPEN`、`PARAM_EYE_L/R_SMILE` | 左右独立开闭、笑眼及超开，开度范围 0–1.5 |
| `PARAM_EYE_BALL_X/Y` | 虹膜与配套高光的视线位移 |
| `PARAM_EYE_SCALE` | 虹膜大小 |
| `PARAM_EYE_HIGHLIGHT` | 独立高光大小 |
| `PARAM_BROW_L/R_X/Y/ANGLE/FORM` | 眉位、角度与曲率；旋转和平移保持眉毛长度 |
| `PARAM_MOUTH_OPEN_Y`、`PARAM_MOUTH_FORM_01` | 闭口嘴角、张嘴与圆口混合 |
| `PARAM_MOUTH_FORM_Y`、`PARAM_MOUTH_SCALE` | 用原口部位置通道近似上下移动，以及口部尺寸调整 |
| `PARAM_TEAR` | 梢、缀理、慈、花帆、沙耶香、瑠璃乃的 `Other_Tear` 通道 |

正负控制的共享标定范围为 −1–1，强度控制为 0–1；超出范围的有限输入按边界值处理。眼泪效果要求模型具备 `Other_Tear`。全体角色的 `PARAM_CHEEK`、`PARAM_CHEEK2`、`PARAM_EYE_FORM`、`PARAM_EYE_BROWS`、`PARAM_MOUTH_SWITCH`、`PARAM_MOUTH_OPEN_Y_MANUAL` 暂未映射。这些效果需要来源角色专属的眼型、装饰或备用嘴图映射，或目标模型未提供的素材；参数存在时其余面部控制仍然生效。

宿主负责 MTN／EXP 混合、自动眨眼与说话接管，适配器消费最终参数。原生表情和参数表情的控制权切换遵循标准生命周期；切回原生表情时恢复底层当前权重。参数表情可配通用 3D 动作，原生表情可配参数身体动作。

形变在实例私有的几何缓冲中计算，Main／Outline 使用同一结果，各 Pass 的原生权重分别保存与恢复。控制量不变时复用已计算的缓冲。卸载时还原原几何引用；模型文件和其他实例共享的原始几何保持完整。

## 宿主注视输入

模块额外导出 `createFocusAdapter(context)`，返回 `restore()`、`apply({x, y})` 和 `dispose()`。`x/y` 是已平滑的 −1–1 注视偏移；宿主在自带表情与物理更新之后调用 `apply`，在下一次姿态求值之前调用 `restore`。它在实例私有的 Eye 几何中移动虹膜与配套高光，保留原生 Morph 权重；归零恢复原始几何引用，输入不变时复用缓冲。参数表情模式将注视量合并到 `PARAM_EYE_BALL_X/Y`，由参数适配器统一处理。
