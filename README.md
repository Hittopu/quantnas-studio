# QuantNAS Studio

QuantNAS Studio 是一个面向“量化后大模型线性层组合搜索”的网页渠道。用户可以描述任务需求、选择候选基座模型和量化方法、填写硬件约束并留下结果邮箱。请求由 Google Apps Script 写入私有 Google Sheet；研究团队完成搜索后，通过 Gmail 将结果 JSON 作为附件交付。

这一版的核心目标是先把产品流程和视觉原型跑起来，方便继续讨论页面信息架构、任务提交字段、后端接口和结果配置格式。

## 当前功能

- 首屏介绍 QuantNAS 的定位：`NAS for your LLM`。
- 右侧 Hero 区新增 NAS 搜索过程展示，包括动态 loss 下降动画和 `Sample / Evaluate / Mutate / Select` 阶段切换。
- 展示从任务需求到 layer-wise NAS 搜索再到配置交付的流程。
- 支持选择候选模型：Qwen2.5 7B/32B、Qwen3 8B/32B、Llama2 7B/13B/70B、Llama3.1 8B/70B。
- 支持两种受约束的搜索模式：固定方法搜索 2/3/4bit，以及固定 bit 搜索量化方法。
- 固定方法模式只允许选择一种量化方法；固定 bit 模式要求至少选择两种方法。
- 支持 SVAMP、MBPP、GSM8K、MMLU、Wikitext2 PPL、C4 PPL 和自定义任务。
- 支持填写任务描述、评测数据提示、硬件、显存、优化偏好和交付物类型。
- 默认展示易读的请求摘要，并可展开查看完整 JSON 和唯一请求编号。
- 通过 Google Apps Script 接收公开网页请求，并写入私有 Google Sheet。
- 自动向用户发送请求确认邮件，并向团队邮箱发送新任务提醒。
- 支持在 Sheet 中粘贴结果 JSON，通过 Gmail 附件发送给用户。
- 支持复制和下载本次请求 JSON。
- 页面底部提供实验室主页和 GitHub 仓库入口，论文公开后再补充正式链接。
- 页面底部新增 `Contact` 区块，展示联系邮箱。

## 页面区块

当前网页主要由以下几个部分组成：

- Hero 首屏：展示 `NAS for your LLM` 主标题、量化层组合视觉和 NAS 搜索 trace。
- Search Pipeline：说明任务提交、搜索空间构建、NAS 评估和配置交付流程。
- Quantized Layer Bank：展示当前支持的模型池。
- Submit Task：提交任务需求，生成 NAS 请求并查看搜索结果。
- Paper & Code：展示实验室主页和 GitHub 仓库。
- Contact：展示联系邮箱，便于合作与试用沟通。

## 当前资源入口

页面当前内置了以下资源入口：

- 实验室主页：`https://miaozhang0525.github.io/aeegroup.html`
- GitHub 仓库：`https://github.com/Hittopu/quantnas-studio`

页面显示文案目前为 `About Our Group` 和 `quantnas-studio.github`。

## 联系方式

页面当前展示的联系邮箱为：

- `Jiaqizhao0455@outlook.com`
- `zhuangjia@stu.hit.edu.cn`

## 项目结构

```text
.
├── index.html                  # 页面结构、资源入口和联系方式
├── server.mjs                  # 零依赖本地静态服务器，同时提供 mock API
├── package.json                # 基础脚本
├── README.md                   # 项目说明
├── docs/
│   └── open-source-stack.md    # 后续生产化开源栈建议
├── apps-script/
│   ├── Code.gs                 # Google Sheet、Gmail 与 Web App 后端
│   ├── appsscript.json         # Apps Script 权限和运行时配置
│   └── README.md               # Google 侧部署与结果发送流程
└── src/
    ├── app.js                  # 表单交互、payload 生成、mock 搜索、API 调用、hero loss 动画
    ├── config.js               # Apps Script Web App URL
    └── styles.css              # 页面视觉、布局、响应式、动效和资源区块样式
```

## Google Sheets + Gmail 渠道

Google 后端不需要自有服务器。部署步骤见 [`apps-script/README.md`](apps-script/README.md)。部署完成后，把 Web App 的 `/exec` 地址填入：

```js
window.QUANTNAS_CONFIG = Object.freeze({
  appsScriptWebAppUrl: "https://script.google.com/macros/s/.../exec",
  channelVersion: "1.0.0"
});
```

公开网页提交后会显示客户端生成的请求编号，并提示用户检查确认邮件。确认邮件是需求已经成功写入 Google Sheet 的最终凭据。

## 运行方式

当前版本是零安装原型，不依赖 `npm install`。只要有 Node.js 就可以运行。

如果本机 `node` 可用：

```powershell
node server.mjs
```

如果当前终端里的 `node` 不可用，可以使用 Codex 桌面环境提供的 Node：

```powershell
& 'C:\Users\32314\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.mjs
```

启动后打开：

```text
http://localhost:5173/
```

如果内置浏览器打不开 `localhost`，可以换成：

```text
http://127.0.0.1:5173/
```

## 检查服务是否启动

在 PowerShell 中检查端口：

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen
```

检查首页是否可访问：

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing
```

## 停止服务

如果服务是在当前终端前台运行，按 `Ctrl + C` 即可停止。

如果服务已经在后台运行，可以先查端口对应进程：

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object OwningProcess
```

然后停止对应进程：

```powershell
Stop-Process -Id <PID>
```

## 本地联调

本地服务器提供 `POST /api/requests`，用于验证表单、请求编号和成功回执界面。它不会写入 Google Sheet，也不会发送邮件。

正式 GitHub Pages 环境必须在 `src/config.js` 中配置 Apps Script Web App `/exec` 地址。浏览器提交后，Google Sheet 和确认邮件是服务端成功接收需求的最终凭据。

## 当前技术选择

当前原型使用：

- 原生 HTML：降低启动成本，便于快速调整页面结构。
- 原生 CSS：保证视觉风格可控，不受默认组件库限制，并方便快速定制 Hero 动画和资源卡片排版。
- 原生 JavaScript：实现表单状态、请求 payload、Apps Script 提交、请求回执下载和 hero loss 数值动画。
- Node.js 内置 `http` 模块：提供零依赖本地服务器。

后续生产化建议迁移到：

- Vite + React：正式组件化开发。
- Motion for React：页面转场、任务进度、结果 reveal 动效。
- lucide-react：统一图标系统。
- TanStack Query：真实 NAS job 的提交、轮询和缓存。
- Zod：前后端 payload schema 校验。

更多说明见 `docs/open-source-stack.md`。

## 下一步建议

- 将 `your-org/quant-layer-bank` 替换为真实 Hugging Face organization 和 repo 命名。
- 将 GitHub 占位链接和 arXiv 占位链接替换为正式地址。
- 与后端约定真实 NAS job 的状态模型，例如 `queued`、`running`、`completed`、`failed`。
- 增加异步任务轮询接口，例如 `POST /api/nas/jobs` 和 `GET /api/nas/jobs/:job_id`。
- 增加用户上传评测集或粘贴数据集链接的入口。
- 增加结果对比页，展示多个 Pareto candidate 的显存、延迟、质量保留和 layer composition 差异。
- 如果要公开演示，补充项目 logo、真实论文/方法引用和 HF repo 链接。
