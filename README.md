# QuantNAS Studio

QuantNAS Studio 是一个面向“量化后大模型线性层组合搜索”的网页原型。用户可以在网页上描述任务需求、选择候选基座模型和量化方法、填写硬件约束，然后生成一个标准化 NAS 搜索请求。当前版本内置本地 mock 搜索结果，后续可以替换为你们服务器上的真实 NAS 搜索服务。

这一版的核心目标是先把产品流程和视觉原型跑起来，方便继续讨论页面信息架构、任务提交字段、后端接口和结果配置格式。

## 当前功能

- 首屏介绍 QuantNAS 的定位：`NAS for your LLM`。
- 右侧 Hero 区新增 NAS 搜索过程展示，包括动态 loss 下降动画和 `Sample / Evaluate / Mutate / Select` 阶段切换。
- 展示从任务需求到 layer-wise NAS 搜索再到配置交付的流程。
- 支持选择候选模型：Qwen2.5 7B/32B、Qwen3 8B/32B、Llama2 7B/13B/70B、Llama3.1 8B/70B。
- 支持选择量化线性层来源：ParoQuant、GPTAQ、SlimLLM、LRQ+。
- 支持填写任务描述、评测数据提示、硬件、显存、延迟优先级、质量保留下限和交付物类型。
- 实时生成 NAS 请求 payload 预览。
- 支持本地 mock 搜索，返回候选配置 JSON、HF layer manifest 和估计指标。
- 支持填写真实 NAS API Endpoint，将表单 payload 直接 POST 到后端服务。
- 支持复制和下载搜索结果 JSON。
- 页面底部新增 `Paper & Code` 区块，用于展示实验室主页、GitHub 占位链接和 arXiv 占位链接。
- 页面底部新增 `Contact` 区块，展示联系邮箱。

## 页面区块

当前网页主要由以下几个部分组成：

- Hero 首屏：展示 `NAS for your LLM` 主标题、量化层组合视觉和 NAS 搜索 trace。
- Search Pipeline：说明任务提交、搜索空间构建、NAS 评估和配置交付流程。
- Quantized Layer Bank：展示当前支持的模型池。
- Submit Task：提交任务需求，生成 NAS 请求并查看搜索结果。
- Paper & Code：展示实验室主页、GitHub 占位地址和 arXiv 占位地址。
- Contact：展示联系邮箱，便于合作与试用沟通。

## 当前资源入口

页面当前内置了以下资源入口：

- 实验室主页：`https://miaozhang0525.github.io/aeegroup.html`
- GitHub 仓库：`https://github.com/Hittopu/quantnas-studio`
- arXiv 占位链接：`https://arxiv.org/abs/0000.00000`

说明：

- arXiv 当前仍是占位地址，后续只需要替换 `index.html` 中对应卡片的 `href` 和显示文案即可。
- 页面显示文案目前为 `About Our Group`、`quantnas-studio.github` 和 `quantnas-studio.arxiv`。

## 联系方式

页面当前展示的联系邮箱为：

- `Jiaqizhao0455@outlook.com`
- `3231487539@qq.com`

## 项目结构

```text
.
├── index.html                  # 页面结构、资源入口和联系方式
├── server.mjs                  # 零依赖本地静态服务器，同时提供 mock API
├── package.json                # 基础脚本
├── README.md                   # 项目说明
├── docs/
│   └── open-source-stack.md    # 后续生产化开源栈建议
└── src/
    ├── app.js                  # 表单交互、payload 生成、mock 搜索、API 调用、hero loss 动画
    └── styles.css              # 页面视觉、布局、响应式、动效和资源区块样式
```

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

## 使用本地 mock 搜索

打开页面后直接填写表单，不填写“真实 NAS API Endpoint”，点击“启动 NAS 搜索”。前端会执行本地模拟流程，并生成一个示例配置结果。

mock 结果包含：

- `selected_base_model`：模拟选择出的基座模型。
- `estimated_metrics`：模拟显存、延迟和质量保留指标。
- `layer_composition`：逐层组合配置。
- `hf_pull_manifest`：用于后续从 Hugging Face 拉取线性层 shard 的清单结构。

## 接入真实 NAS 服务

在页面表单的“真实 NAS API Endpoint”中填入后端地址，例如：

```text
/api/nas/search
```

或：

```text
https://your-server.example.com/api/nas/search
```

提交后前端会发送 `POST` 请求，`Content-Type` 为 `application/json`。

请求 payload 示例：

```json
{
  "project_name": "金融长文本问答压缩模型",
  "task_type": "long_context_qa",
  "task_label": "长上下文问答",
  "task_description": "需要在中文金融研报问答任务上保持质量，同时降低显存占用。",
  "dataset_hint": "内部 dev set 2k 条；指标为 EM/F1；最大上下文 32k。",
  "candidate_base_models": ["Qwen2.5-7B", "Llama3.1-8B"],
  "quantized_layer_sources": ["ParoQuant", "GPTAQ", "SlimLLM"],
  "constraints": {
    "hardware": "rtx_4090",
    "memory_cap_gb": 16,
    "latency_priority": 7,
    "quality_floor_percent": 95
  },
  "deliverable": "config_json",
  "contact_email": "name@lab.org",
  "requested_at": "2026-04-19T00:00:00.000Z"
}
```

建议后端返回结构：

```json
{
  "config_version": "0.1.0",
  "job_id": "qnas-xxx",
  "status": "completed",
  "selected_base_model": "Qwen2.5-7B",
  "estimated_metrics": {
    "memory_footprint_gb": 10.6,
    "latency_index": 8.1,
    "quality_retention_percent": 95.8
  },
  "layer_composition": [
    {
      "layer_range": "0-7",
      "quantizer": "ParoQuant",
      "hf_source": "hf://your-org/quant-layer-bank/qwen2.5-7b/paroquant/layers-0-7",
      "reason": "保留 early attention 稳定性"
    }
  ],
  "hf_pull_manifest": {
    "namespace": "your-org/quant-layer-bank",
    "pull_strategy": "download selected linear-layer shards only",
    "shards": [
      "hf://your-org/quant-layer-bank/qwen2.5-7b/paroquant/layers-0-7"
    ]
  }
}
```

## 内置 mock API

本地服务器提供了一个简单 mock API：

```text
POST /api/nas/search
```

如果在页面里把“真实 NAS API Endpoint”填成 `/api/nas/search`，前端会调用 `server.mjs` 里的 mock 接口。这适合验证前后端联调流程。

## 当前技术选择

当前原型使用：

- 原生 HTML：降低启动成本，便于快速调整页面结构。
- 原生 CSS：保证视觉风格可控，不受默认组件库限制，并方便快速定制 Hero 动画和资源卡片排版。
- 原生 JavaScript：实现表单状态、请求 payload、mock 搜索、结果下载和 hero loss 数值动画。
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
