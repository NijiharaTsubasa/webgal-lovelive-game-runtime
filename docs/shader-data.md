# Shader 数据接口

## 1. 数据从哪里进入

材质使用 glTF `material.extras` 中的标准 `shader`、`shaderParams`、`textures`、`renderState` 和 `passes`。本仓库 config 声明 Shader 名、sampler 和 Pass sections；材质引用这些名字。合并、纹理绑定和 Shader Runtime 调用遵循参数化渲染标准。

各 Shader 的私有参数名与类型由对应 GLSL 的 `u*` uniform 声明确定：材质 shaderParams 键去掉开头的 `u`。纹理槽名由 config 的 samplers 声明。JS 动态生成的灯光、时间、屏幕尺寸、抓屏纹理 uniform 不需要由 GLB 提供；不能把每帧场景输入误当成模型固定元数据。

## 2. LLAS 顶点色与 Main 关键字

`llas-member` 的 Main 和 Outline 需要 glTF primitive 的自定义 `_SHADER_COLOR` 四分量 RGBA 属性；加载为 Three geometry attribute `_shader_color`。这是原 Shader 使用的顶点数据，不是额外的 Three PBR vertexColors。`llas-general-transparent` 的 `shaderParams.VertexColor` 为真时也需要该属性。

`llas-member` 的 Main 私有字段位于 **`material.extras.passes[].extras.keywords`**，不是材质顶层 extras：

```json
{"id":"Main","extras":{"keywords":["_CHEEK_ON","_MATCAP_ON"]}}
```

即使无关键字也提供空数组。当前识别：

| 关键字 | 当前处理 |
| --- | --- |
| `_CHEEK_ON` | 启用脸红编译分支 |
| `_MATCAP_ON` | 启用 Matcap 编译分支 |
| `_EMISSIVE_ON` | 原 live `_Beat` 输入尚未实现，当前立绘运行时拒绝此路径 |
| `_RIMLIGHT_ON` | 保留源声明，不选择额外 GLES3 变体，Rimlight 已在原程序中 |
| `_MATCAPTEXADD_ON` | 保留源声明；MatcapTexAdd 由 uniform 控制 |

这里描述现有可执行实现，不意味着原游戏只允许这几个词；新的源变体需要取得程序证据后配套移植。

## 3. LLAS 参数表情与脸红 Shader 的包内接口

普通脸参数适配器通过 context 的 `getShaderRuntimes(material)` 查找提供 `setExternalCheek` 的实例。`llas-member` 实现：

```js
runtime.setExternalCheek({ intensity, layer: 0 });
runtime.setExternalCheek(null); // 退出接管，恢复原编译分支
```

intensity 钳制为 `[0,1]`；layer 四舍五入并钳制到纹理数组层范围。返回 `{supported:true,layerCount}` 或 `{supported:false,reason}`。支持条件是 Main Pass 实际提供了 `CheekTex`，且解析结果为有有效层数的 DataArrayTexture；缺失纹理的白色 fallback 不算支持。

适配器当前统一用第 0 层，合并 BanG Dream 的两种脸红，不向通用渲染器增加 LLAS 特判。原模型初始关闭脸红也需要保留原 CheekTex，才能在接管时启用。`setExternalCheek(null)` 恢复原 define，强度/层号控制只在接管期间注入 Main。

## 4. 莲之空场景输入

材质数据通过第一节的字段进入；各 JS 从当前 Three 场景取得灯光、环境、相机、绘制尺寸和 MSAA 状态。相关适配集中在各 Shader JS 与 `shared-runtime.js`，不能据此复现原 Unity 场景本身。

`highlight-distortion` 的抓屏纹理由 JS 管理，GLB 不需要引用它；其生命周期和抓取时机属于 Shader 实现。GLSL 材质参数、原贴图、顶点属性和 Pass 顺序仍来自资源，不能用节点名或材质名替代这些数据。

`melpot-toon-hlslmacros` 使用 glTF 的 `TANGENT` 四分量属性，加载为 `tangent`，其中 W 保存切线方向符号。重新生成网格时要与法线、UV 和蒙皮数据一起保留；它不是材质 uniform。
