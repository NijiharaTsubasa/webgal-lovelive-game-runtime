# WebGAL LoveLive 游戏运行时资源包

本仓库提供游戏模型所需的 Shader、Behavior 和参数表情适配器。

Behavior 用于实现模型专属的运行时逻辑（相当于 Unity 的 MonoBehaviour），例如根据表情切换辅助节点的显隐、调整眼部节点或角色体型。它通过统一接口随模型加载和更新，让通用渲染器无需了解各游戏模型的内部实现。

参数表情适配器将《BanG Dream! 少女乐团派对》 Live2D `.mtn` 动作和 `.exp.json` 表情中的面部参数映射到 glTF 模型，使其能够使用这套 Live2D 资源驱动表情。

* `packages/hasunosora_runtime`：莲之空。
* `packages/garupa_runtime`：BanG Dream。
* `packages/llas_runtime`：LLAS。

每个目录都是独立资源包，入口为 `config.json` 。使用时将所需目录复制到游戏的 `figure` 目录下，由 Terre 生成资源清单。

## 已实现功能清单

| 游戏名 | Shader 移植 | 模型专属 Behavior |  参数表情适配器  |
| ------ | ------ | ------ | ------ |
| 《LoveLive! 学园偶像祭 群星闪耀》 | ✅已完成 | ✅表情适配、璃奈板适配 | ✅已完成 |
| 《Link! Like! LoveLive!》 | ✅已完成 | ✅模型辅助骨 | ✅已完成，支持11名主角，暂不支持NPC |
| 《BanG Dream! 少女乐团派对》 | ❌仅预研，未启动 | ✅AvatarScaler（部分行为为近似还原） | ❌未启动 |

JS 与渲染器之间的通用接口见 [渲染器仓库的标准文档](https://github.com/NijiharaTsubasa/webgal-lovelive-gltf-renderer) ；各游戏运行时与模型配置、glTF 数据之间的自定义约定见 [游戏运行时数据接口](docs/README.md) 。

## 运行测试：

```sh
npm install
npx playwright install chromium
npm test
```

## 生成式人工智能使用声明

本项目绝大多数代码与文档均由生成式人工智能（Generative AI）工具生成。核心路线和方案由作者与 AI 共同讨论确定。

但由于作者本人对该领域技术栈不熟悉，未对代码进行深度的代码审查或系统的测试，主要对最终呈现的功能效果进行验收，因此代码库可能存在较多技术债务与不规范之处。

如您在使用中遇到问题，或愿意帮助优化、重构底层代码，欢迎通过 Issue 或 Pull Request 参与共建。
