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

新增源变体需要取得对应的原程序证据并配套实现。

## 3. LLAS 参数表情与脸红 Shader 的包内接口

普通脸参数适配器通过 context 的 `getShaderRuntimes(material)` 查找提供 `setExternalCheek` 的实例。`llas-member` 实现：

```js
runtime.setExternalCheek({ intensity, layer: 0 });
runtime.setExternalCheek(null); // 退出接管，恢复原编译分支
```

intensity 钳制为 `[0,1]`；layer 四舍五入并钳制到纹理数组层范围。返回 `{supported:true,layerCount}` 或 `{supported:false,reason}`。支持条件是 Main Pass 实际提供了 `CheekTex`，且解析结果为有有效层数的 DataArrayTexture；缺失纹理的白色 fallback 不算支持。

适配器统一用第 0 层，合并 BanG Dream 的两种脸红；该接口由 LLAS 配置包实现。原模型初始关闭脸红也需要保留原 CheekTex，才能在接管时启用。`setExternalCheek(null)` 恢复原 define，强度/层号控制只在接管期间注入 Main。

## 4. 莲之空场景输入

材质数据通过第一节的字段进入；各 JS 从当前 Three 场景取得灯光、环境、相机、绘制尺寸和 MSAA 状态。相关适配集中在各 Shader JS 与 `shared-runtime.js`，使用宿主场景提供的输入。

`highlight-distortion` 的抓屏纹理由 JS 管理，GLB 不需要引用它；其生命周期和抓取时机属于 Shader 实现。GLSL 材质参数、原贴图、顶点属性和 Pass 顺序仍来自资源，不能用节点名或材质名替代这些数据。

`melpot-toon-hlslmacros` 使用 glTF 的 `TANGENT` 四分量属性，加载为 `tangent`，其中 W 保存切线方向符号。重新生成网格时要与法线、UV 和蒙皮数据一起保留；它不是材质 uniform。

## 5. 幻日夜羽角色管线

模型组件声明 `renderProfile: "yohane-character"`。配置包使用 `yohane-toon`、`yohane-toon-double-side` 和 `yohane-aura`；法线预通道、颜色绘制、屏幕描边、透明绘制和 Bloom 泛光由同一配置组织。法线纹理保存带符号的世界法线，需要支持浮点颜色附件的 WebGL2 上下文。

绘制阶段由源材质的 `renderQueue` 决定：0～2500 进入不透明阶段，2501～5000 进入透明阶段。表面 Aura 使用材质 Pass 绘制；带有 AuraArc 的模型还绘制动态粒子光弧，并读取当前不透明深度实现交界处淡出。

Bloom 使用原剧情相机的阈值、强度和低质量滤波配置，在半分辨率 HDR 纹理上构建模糊金字塔，再合成至角色颜色。透明角色画布根据泛光亮度生成外层覆盖度，使柔光逐渐淡出；外部背景通过普通透明混合叠加，因此其合成观感与原游戏整场景加法泛光存在差异。

模型私有元数据保存原 AuraArc 组件的采样网格、变换和属性覆盖值。运行时按源顶点顺序采样当前蒙皮及形变结果，执行粒子、噪声和光带计算；曲线资源由 Unity 原生烘焙。宿主生成初始随机 seed，按固定步长推进模拟，并将光带四角拆为两个三角形绘制。这些适配由 Yohane 配置包管理。

颜色 Pass 的私有元数据 `extras.depthNormalsPass` 与 `extras.shadowCasterPass` 保存对应辅助变体的 Pass ID。模型材质参数表同时提供辅助 Pass 实际读取的参数和纹理；配置包通过材质工厂选取法线 Pass。普通颜色 Pass 与法线 Pass 的关键字组合分别选择，例如 `_FLATNORMAL_ON` 影响法线预通道。

材质参数使用 Unity 传给 Shader 的数值：普通 Color 的 RGB 转为线性，HDR Color 与普通 Vector 保留原值，alpha 保留原值。各纹理的颜色空间和采样状态由资源数据提供。纹理坐标先恢复来源 UV，再应用来源 ST；取样坐标的纵轴翻转对应导出图像的方向。

`unity-inputs.js` 将宿主的模型、相机和方向光矩阵转换到原 Shader 坐标约定。配置包提供播放时钟，灯光取当前可见方向光中强度最大的一个。描边读取当前帧的法线与深度，并按原材质设置执行 Multiply 合成。

## 6. BanG Dream 菜单角色管线

### 6.1 维护入口与支持范围

菜单角色使用 `renderProfile: "garupa-menu"`。材质的 `extras.shader` 选择 `garupa-meteor`、`garupa-meteor-offset` 或 `garupa-meteor-transparent`，分别对应原游戏的 `Meteor/MeteorShader`、`Meteor/MeteorShaderOffset`、`Meteor/MeteorShaderTransparent`。

Shader实现直接在下列源码中维护，修改时应同时维护文件之间的对应关系：

| 文件（相对于 `packages/garupa_runtime/`） | 作用 |
| --- | --- |
| `config.json` | 注册材质Shader名、sampler、Pass、命名代码片段及菜单配置的依赖 |
| `shaders/meteor.glsl` | 公共函数、每个原顶点／片元程序及其调用代码；是实际Shader源码 |
| `shaders/meteor-runtime.js`、`meteor-sections.js` | 选择程序、裁取当前代码片段、绑定动态参数及坐标输入 |
| `shaders/meteor-variants.js`、`meteor-variant-data.js`、`meteor-program-data.js` | 程序选择规则、原材质关键字到程序的对应表、程序输入输出与活动参数描述 |
| `render-profiles/garupa-menu.js`、`meteor-schedule.js`、`meteor-oit.js`、`meteor-bounds.js` | 组织绘制、选择Pass、管理公共透明合成目标，以及更新源Renderer边界 |

配置包含11个Pass、56个独立程序（9个顶点、47个片元），覆盖472条材质／Pass／阶段选择记录。这里的“程序”指单个顶点或片元阶段；浏览器将一个顶点程序与一个片元程序链接成可绘制的组合。实际执行的Pass由菜单调度选择。

### 6.2 程序选择与命名片段拼接

GLB每个Pass的私有 `extras.materialKeywords` 保存原材质关键字，`extras.lightMode` 保存原Pass标签；不要与LLAS的 `extras.keywords` 混用。选择器使用源Shader名、稳定Pass ID、顶点／片元阶段、材质关键字，以及明确的全局关键字状态，查表取得原程序身份。全局关键字只按该记录的 `global_keyword_universe` 投影；原生fallback以确定的程序对应关系记录在表中。没有记录、多个匹配或缺少所需状态均报错。

`meteor-program-data.js` 以完整源程序SHA作为键，其 `define` 是 `METEOR_VERTEX_<短ID>` 或 `METEOR_FRAGMENT_<短ID>`。GLSL中的 `Retained source` 注释、宏名、命名片段和选择表共同定位一个原程序。源SHA是追溯原始程序的身份，不是修改后的GLSL文件校验和；仅调整排版时不要重新编号。修复算法必须有原游戏证据，不能为了减小代码或改善外观改成近似公式。

`meteor.glsl` 保存116个标准命名section。公共声明为 `METEOR_VERTEX_COMMON` 和 `METEOR_FRAGMENT_COMMON`；每个程序有 `<define>_PRELUDE`（声明与函数）和 `<define>_BODY`（调用与输入输出适配）。`METEOR_FRAGMENT_BEGIN` 初始化输出变量，`METEOR_FRAGMENT_END` 将结果交回Three模板，必须分别位于所选片元调用之前和之后。

现有标准支持在一个注入位置配置section名称数组。`config.json` 为每个Pass列出公共片段和该Pass可能选择的程序片段，loader按数组顺序读取、连接。连接后的程序片段仍带有以下包内注释边界：

```glsl
// @meteor-program METEOR_FRAGMENT_<短ID>
#if defined(METEOR_FRAGMENT_<短ID>)
// 此处为该程序原有的声明、函数或调用代码
#endif
// @meteor-end METEOR_FRAGMENT_<短ID>
```

这是结构示意，`<短ID>`须替换为实际ID。标准loader识别外围的 `// @section NAME` 与 `// @end`；`meteor-sections.js` 识别连接后的 `@meteor-program`／`@meteor-end` 注释边界。边界名与原 `#if defined(...)` 必须一致，不能删除结束标记、嵌套包内边界或重复同名程序。

`configurePass` 先缓存已加载片段；原选择器确定程序后，runtime只修改当前材质的 `passMetadata.sections`，保留所选顶点程序、片元程序及公共代码。渲染器通过 `onBeforeCompile` 注入这些代码。不要修改registry共享的片段或原始候选缓存，否则一个材质的选择会污染其他角色。程序身份改变才重新选择片段并更新编译缓存键；重复帧复用结果，缺失切线时的宏变化不需要重新拆拼源码。

每个绘制Pass交给Three模板的代码包含一对选中程序及公共代码。源码资源按整个文件读取，程序选择发生在加载后的CPU拼接阶段。

### 6.3 帧输入与公共绘制调度

`garupa-menu`管理角色共同使用的离屏目标与透明合成流程。模型材质提供固定参数，场景灯光、相机、当前骨骼矩阵、绘制目标尺寸等由JS逐帧绑定。可通过 `scene.userData.meteorLights` 指定灯光集合，通过 `scene.userData.meteorFrame` 提供明确的源帧输入；不应把这些动态值写死进GLB，或从材质名称猜测。

Pass是否执行由源层号、材质 `renderQueue`、Pass的 `lightMode` 及调度规则共同决定。`meteor-schedule.js` 按原标签优先级选择第一个匹配Pass，标签比较不区分大小写；**配置中有一个Pass，不等于每帧就会执行它**。当前顺序是场景全局输入、不透明、Outline、公共OIT累积与合成、其余透明、AlphaWriteOff。OIT初始化及跨帧状态同样属于原调度，不能移成每个Material各自清空和合成。

OIT把指定透明对象集中绘制到公共附件，再统一合成。它需要原清空值、附件混合、源颜色保存与深度复制步骤；这些在 `meteor-oit.js` 与调度模块中维护，不在单个材质中另造一套。`AlphaWriteOff`是只写RGB、不写alpha的绘制阶段。当前 `depthOnlyPass=false`，不额外执行只写深度的Pass；正常绘制中的深度测试和写入仍按各Pass状态执行。

内部目标的宽高取自宿主提供的物理像素viewport。不透明与Outline阶段使用线性RGBA8、24位深度和4倍MSAA；随后将颜色与深度解析到同尺寸的单采样目标，继续执行OIT及其余透明绘制。OIT累积附件使用半浮点格式，深度复制保持单采样。最终输出处理宿主的sRGB颜色编码、透明覆盖与预乘约定，包含alpha为零的边界。设备须支持RGBA8和24位深度的4倍多采样，能力不足时加载报错。

**4倍MSAA是降低内部渲染分辨率后，为改善细描边断续而采用的画质与性能折中，不来自原本参考的菜单流程。**原菜单的 `Costume3DViewer.Initialize` 创建单采样目标；这里的4倍采样参考原Live最高画质档：`MVQualitySettingsManager` 将该档的 `MsaaSamples` 设为4，`RenderingController` 将其写入渲染目标及URP配置。本配置采用这一采样档位作为宿主适配，材质的 `_OutlineWidth`、原Shader计算与OIT公式保持原值。MSAA主要改善几何覆盖边缘，纹理Alpha Clip产生的细节仍受采样分辨率影响。

`prepare` 在首次加载、绘制尺寸或角色成员变化时建立资源，并执行初始化与完整透明流程的预热绘制。每次异步等待后检查宿主的 `frame.cancelled()`，取消时停止继续绘制。正常播放时，`render` 在提交绘制前同步更新骨骼包围盒、剔除、排序、脸部方向和灯光帧输入；宿主可以同步完成角色更新、绘制和纹理上传。

### 6.4 模型输入、坐标与纹理

模型保留原 `meteorLayer`、`meteorBounds`、`meteorBoundsAnchor` 等节点数据。动态边界来自原Renderer的骨骼包围盒，既用于视锥剔除，也用于排序；源RootBone同时决定Shader对象空间，不应替换成glTF Mesh节点的世界矩阵。头身组合后，配置包通过标准 `parts.nodeBindings` 找到源节点的等价实际节点，不能用同名骨骼猜对应关系。人物整体位移应在本帧准备绘制前完成。

`meteorBounds.bones` 按源顺序保存参与包围盒并集的非空骨盒，每项包含节点绑定、`bindMatrix`、`center` 和 `extents`，列表必须非空。`meteorBounds.root` 独立保存源RootBone绑定；骨盒通过各自节点绑定定位，列表位置只表示处理顺序。

Shader使用原UV通道 `_source_uv0`／`_source_uv1`；不要再套一次材质UV变换。原缺失通道的取值由已确认的输入语义处理，例如缺失切线使用原默认值，并在蒙皮后的源输入位置注入，不通过重新生成几何切线替代。面部方向与非均匀缩放也有独立适配；相关坐标变换集中在 `meteor-coordinates.js` 和菜单配置中，修改后的测试应覆盖头身组合、动作、边界与整体位移。

每个材质runtime独立持有坐标矩阵缓冲，绘制时根据当前对象、RootBone和相机矩阵原位更新。菜单附加灯的默认输入逐帧在已有uniform缓冲中清零，再应用 `meteorFrame.uniforms` 的显式覆盖；修改缓存时须保留这一更新顺序与实例隔离。

`shaderParams` 的颜色数值保留原传给Shader的语义；普通颜色的RGB按原规则转为线性，alpha与普通向量不随意转换。JSON标量按目标uniform声明绑定 `float`、`int` 或 `uint`，整数不能当成任意浮点近似。

纹理使用GLB中的PNG图像，通过标准 `texture.extras.colorSpace` 和 `anisotropy` 声明颜色空间及各向异性过滤等级，寻址和缩放过滤由glTF sampler提供。MatCap将原显式选中的级保存为单级图像，并保留对应的LOD偏移。设备不支持所需各向异性等级时应报错，不能静默降低。修改纹理处理时须保留颜色空间、MatCap选定图像及其LOD对应关系和采样参数。

### 6.5 修改时的配套检查

修改现有函数或调用代码，从 `Retained source` 和对应宏名定位到程序的 `_PRELUDE`／`_BODY`。保留各程序独立片段，以及公共段与输出段的相对位置。修改源程序输入或采样器时，还要同步 `meteor-program-data.js` 的活动输入／输出／参数描述以及config和模型实际提供的数据。

新增或改变材质变体时，联合维护 `meteor-variant-data.js` 的候选与全局关键字集合、`meteor-program-data.js` 的程序描述、GLSL片段及config中对应Pass的section数组。新增源代码但没有登记选择关系不会自动生效；只改表而没有对应片段应明确失败。改变绘制阶段或目标资源时，应共同检查profile、schedule和OIT的约束。

测试通过相邻的 `webgal-lovelive-gltf-renderer` 检出使用实际渲染器，依赖位置见本仓库 `package.json`。安装依赖后，可在仓库根目录执行以下CPU检查：

```sh
node --test --test-concurrency=1 tests/meteor-package.test.mjs tests/meteor-runtime.test.mjs tests/meteor-variants.test.mjs tests/meteor-menu.test.mjs tests/meteor-bounds.test.mjs tests/meteor-schedule.test.mjs
```

其中runtime测试通过真实registry和材质绑定流程在CPU调用 `onBeforeCompile`，检查所有候选搭配的程序选择、异常标记报错、材质实例隔离及缓存行为。测试还校验程序集合、身份指纹与候选对应关系；有证据支持的范围变化需要配套更新断言，不能为消除失败直接放宽检查。

CPU检查验证数据与拼接；实际修改程序、采样、坐标或调度后，还需通过浏览器GPU编译、代表模型画面及性能验收。忠实实现要求原运算、分支、状态与调度有证据对应，允许不同GPU正常的浮点舍入及标准滤波差异；原算法明确要求的量化、取整和位操作仍须保留。
