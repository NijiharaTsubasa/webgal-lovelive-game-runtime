# 游戏运行时数据接口

这里说明游戏运行时 JS 与模型配置、glTF 数据之间的私有约定，供生成资源、编辑配置和维护运行时实现时参考。这些约定由对应游戏包解释，不是通用模型标准的新增字段。

| 文档 | 内容 |
| --- | --- |
| [LLAS 表情接口](llas-face.md) | 普通脸的辅助 TRS/显隐、璃奈板 Morph 信号、参数表情适配所需的模型数据 |
| [LLAS 撑裙接口](llas-skirt.md) | 来源膝轴、裙骨参数与物理更新后的撑裙修正 |
| [莲之空参数表情](hasunosora-face.md) | 角色兼容域、底层 Morph 与参数控制能力 |
| [莲之空辅助骨](hasunosora-sub-bone.md) | 来源局部坐标桥、有序 Swing/Twist/Move 规则及动画生命周期 |
| [Garupa 体型接口](garupa-avatar-scaler.md) | 头部体型配置、身体节点绑定和原坐标系到归一化骨架的投影 |
| [Shader 数据接口](shader-data.md) | glTF 材质与顶点数据、LLAS 私有关键字及包内脸红控制 |

宿主调用 JS 的通用接口见渲染器仓库的 [Behavior 标准](https://github.com/NijiharaTsubasa/webgal-lovelive-gltf-renderer/blob/main/docs/model_behavior_spec.md)、[参数化渲染标准](https://github.com/NijiharaTsubasa/webgal-lovelive-gltf-renderer/blob/main/docs/parameterized_rendering_spec.md)和[参数动作与表情标准](https://github.com/NijiharaTsubasa/webgal-lovelive-gltf-renderer/blob/main/docs/parameter_driven_animation_spec.md)。本文只补充它们留给游戏包解释的数据。
