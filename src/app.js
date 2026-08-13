const channelConfig = window.QUANTNAS_CONFIG || {};

const baseModels = [
  "Qwen2.5-7B",
  "Qwen2.5-32B",
  "Qwen3-8B",
  "Qwen3-32B",
  "Llama2-7B",
  "Llama2-13B",
  "Llama2-70B",
  "Llama3.1-8B",
  "Llama3.1-70B"
];

const quantizers = ["ParoQuant", "GPTAQ", "SlimLLM", "LRQ+"];

const benchmarkLabels = {
  svamp: { en: "SVAMP", zh: "SVAMP" },
  mbpp: { en: "MBPP", zh: "MBPP" },
  gsm8k: { en: "GSM8K", zh: "GSM8K" },
  mmlu: { en: "MMLU", zh: "MMLU" },
  wikitext2_ppl: { en: "Wikitext2 PPL", zh: "Wikitext2 PPL" },
  c4_ppl: { en: "C4 PPL", zh: "C4 PPL" },
  other: { en: "Other task", zh: "其他任务" }
};

const uiText = {
  en: {
    copyRequest: "Copy request JSON",
    copied: "Copied",
    delivery: "JSON via email",
    failedPrefix: "Submission failed: ",
    invalid: "Submission did not pass validation",
    sending: "Submitting...",
    submit: "Submit request",
    validating: "Validating request fields",
    transmitting: "Securely transmitting request",
    processing: "Saving the request and sending the confirmation email",
    sent: "Request sent. Please check your confirmation email.",
    pending: "The request was sent. Google is still processing the response; please use the confirmation email as the final receipt.",
    endpointMissing: "The request channel is not configured yet. Please try again later or contact us by email.",
    receiptMessage: "Your request has been sent. A confirmation email means it was successfully recorded in Google Sheets.",
    receiptCopy: (receipt) => `Request ${receipt.request_id} was sent. Once the confirmation email arrives, it has entered the processing queue. Results will be sent to ${receipt.contact_email}.`,
    otherUrlRequired: "A dataset or task URL is required when Other task is selected."
  },
  zh: {
    copyRequest: "复制请求 JSON",
    copied: "已复制",
    delivery: "JSON via email",
    failedPrefix: "提交失败：",
    invalid: "提交未通过校验",
    sending: "提交中...",
    submit: "提交搜索需求",
    validating: "正在校验需求字段",
    transmitting: "正在加密传输需求",
    processing: "正在写入需求并发送确认邮件",
    sent: "需求已发送，请检查确认邮件",
    pending: "请求已发送，Google 仍在处理响应，请以确认邮件作为最终回执。",
    endpointMissing: "需求接收渠道尚未配置，请稍后再试或通过页面底部联系邮箱提交。",
    receiptMessage: "请求已发送。确认邮件到达后即表示需求已成功写入 Google Sheet。",
    receiptCopy: (receipt) => `请求 ${receipt.request_id} 已发送。确认邮件到达后即表示需求已写入处理队列；结果完成后会发送到 ${receipt.contact_email}。`,
    otherUrlRequired: "选择其他任务时必须提供数据集或任务说明网址。"
  }
};

const themeText = {
  en: {
    toDay: "Switch to day mode",
    toNight: "Switch to night mode"
  },
  zh: {
    toDay: "切换到白天模式",
    toNight: "切换到夜晚模式"
  }
};

function createRequestId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = new Uint32Array(1);
  window.crypto.getRandomValues(random);
  return `QNAS-${date}-${random[0].toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

const state = {
  selectedModel: "Qwen3-8B",
  selectedQuantizers: new Set(quantizers),
  fixedMethodQuantizer: "ParoQuant",
  requestId: createRequestId(),
  lastResult: null,
  currentStep: 1,
  maxVisitedStep: 1,
  language: "en",
  theme: window.__QUANTNAS_INITIAL_THEME__ || document.documentElement.dataset.theme || "night",
  localizedTextNodes: [],
  localizedAttributes: []
};

const elements = {
  form: document.querySelector("#nas-form"),
  modelChips: document.querySelector("#model-chips"),
  quantizerChips: document.querySelector("#quantizer-chips"),
  preview: document.querySelector("#payload-preview"),
  liveSummary: document.querySelector("#live-summary"),
  searchMode: document.querySelector("#searchMode"),
  targetPrecision: document.querySelector("#targetPrecision"),
  quantizerLegend: document.querySelector("#quantizer-legend"),
  quantizerHelp: document.querySelector("#quantizer-help"),
  languageToggle: document.querySelector("#language-toggle"),
  themeToggle: document.querySelector("#theme-toggle"),
  dayThemeStylesheet: document.querySelector("#day-theme-stylesheet"),
  projectName: document.querySelector("#projectName"),
  datasetUrl: document.querySelector("#datasetUrl"),
  datasetUrlField: document.querySelector("#dataset-url-field"),
  datasetUrlHelp: document.querySelector("#dataset-url-help"),
  progressPercent: document.querySelector("#progress-percent"),
  progressBar: document.querySelector("#progress-bar"),
  progressLabel: document.querySelector("#progress-label"),
  resultSection: document.querySelector("#result-section"),
  resultJson: document.querySelector("#result-json"),
  resultCopy: document.querySelector("#result-copy"),
  resultMetrics: document.querySelector("#result-metrics"),
  copyButton: document.querySelector("#copy-result"),
  downloadButton: document.querySelector("#download-result")
};

elements.formSteps = Array.from(document.querySelectorAll(".form-step"));
elements.wizardSteps = Array.from(document.querySelectorAll(".wizard-step"));
elements.wizardProgressBar = document.querySelector("#wizard-progress-bar");
elements.reviewSummary = document.querySelector("#review-summary");

const staticTranslations = {
  "搜索流程": "Workflow",
  "模型池": "Model Pool",
  "提交任务": "Submit Request",
  "联系我们": "Contact",
  "开始搜索": "Start Search",
  "量化后逐层搜索运行中": "Post-quantization search is live",
  "面向具体任务，逐线性层选择量化来源，并通过邮件交付可复现的 JSON 配置。": "Choose quantized sources per linear layer for your task, then receive a reproducible JSON configuration by email.",
  "基于 ParoQuant、GPTAQ、SlimLLM、LRQ+ 等量化结果，面向 Qwen、Llama 系列模型进行逐层组合搜索。用户只需要描述任务、约束与评测数据，我们在后端返回最优组合配置文件。": "Compose quantized linear layers from ParoQuant, GPTAQ, SlimLLM, and LRQ+ for Qwen and Llama models. Describe your benchmark and constraints, and we will return the searched configuration.",
  "提交 NAS 任务": "Submit NAS Request",
  "查看工作流": "View Workflow",
  "从任务需求到 Hugging Face 拉取清单": "From task request to Hugging Face manifest",
  "页面先收集任务、模型池、量化方法和资源约束；后端可以接入真实 NAS 服务，返回组合配置、线性层来源和复现实验参数。": "The questionnaire collects the task, model pool, quantization methods, and resource constraints. Our NAS backend returns the composition config, per-linear sources, and reproducible evaluation metadata.",
  "任务画像": "Task Profile",
  "定义任务": "Define the task",
  "确定 benchmark、输入输出形式、评估数据与目标指标。": "Specify the benchmark, input and output format, evaluation data, and target metric.",
  "构建线性层池": "Build the layer bank",
  "从 Qwen、Llama 与不同量化方法中组合逐层候选。": "Compose per-layer candidates across Qwen, Llama, and multiple quantization methods.",
  "搜索并正式复测": "Search and validate",
  "用连续 proxy 产生候选，再以目标 benchmark 与 PPL 复核。": "Generate candidates with a continuous proxy, then validate on the target benchmark and PPL.",
  "交付可复现配置": "Deliver a reproducible config",
  "通过邮件返回逐层 source JSON、模型拉取清单与实验元数据。": "Receive the per-layer source JSON, model manifest, and experiment metadata by email.",
  "收集目标 benchmark、模型、搜索空间、硬件约束与优化偏好。": "Collect the target benchmark, model, search space, hardware constraints, and optimization preference.",
  "搜索空间构建": "Search Space",
  "在 Qwen2.5、Qwen3、Llama2、Llama3.1 等模型的量化线性层池中构造候选。": "Build candidates from quantized linear-layer banks for Qwen and Llama model families.",
  "NAS 评估": "NAS Evaluation",
  "后端按任务评测集和硬件约束搜索 layer-level 组合，输出 Pareto 最优配置。": "Search layer-wise compositions under benchmark and hardware constraints, then select the best validated configuration.",
  "配置交付": "Config Delivery",
  "返回 JSON 配置、HF layer pull manifest、部署提示和可复现实验元数据。": "Receive a JSON config, HF layer manifest, deployment notes, and reproducible experiment metadata.",
  "覆盖主流开源大模型家族": "Major open-source model families",
  "当前层仓库覆盖 Qwen 与 Llama 系列，并以统一 source manifest 管理不同方法和 bit 宽度。": "The layer bank covers Qwen and Llama, with one source manifest across quantizers and bit widths.",
  "描述你的目标任务，我们通过邮箱交付配置": "Choose your target benchmark and receive the config by email",
  "提交后系统会生成请求编号并发送确认邮件。我们完成 NAS 搜索与正式评估后， 会把结果 JSON 作为邮件附件发送到你的邮箱。": "After submission, the system creates a request ID and sends a confirmation email. Once NAS search and formal evaluation finish, the result JSON is delivered as an email attachment.",
  "任务画像": "Task Profile",
  "搜索空间": "Search Space",
  "资源约束": "Constraints",
  "联系确认": "Confirmation",
  "先告诉我们，你希望模型完成什么任务": "Which benchmark should the model optimize?",
  "任务描述越具体，后续搜索空间和评估口径越容易确定。": "Choose a benchmark we support, or select Other task and provide a reference URL.",
  "任务名称": "Task or benchmark",
  "其他任务": "Other task",
  "任务需求描述（可选）": "Task requirements (optional)",
  "描述任务目标、输入输出形式、目标指标和你关心的失败案例。": "Describe the input/output format, target metric, and important failure cases.",
  "评测数据或领域提示（可选）": "Evaluation data or domain notes (optional)",
  "例如：内部 dev set 2k 条；指标为 EM/F1；中文金融研报；最大上下文 32k。": "For example: 2k-item dev set, EM/F1 metric, finance domain, or 32k context.",
  "新任务的数据集或说明链接": "Dataset or task URL for a new task",
  "选择“其他任务”时必须提供网址。": "Required when Other task is selected.",
  "下一步": "Continue",
  "选择候选模型与量化层来源": "Choose one base model and the quantized sources",
  "基座模型单选；量化方法和精度选项会根据搜索模式自动调整。": "Select one base model. Quantization methods and precision options adapt to the search mode.",
  "搜索模式": "Search mode",
  "固定方法，混合 2/3/4bit": "Fixed method, search 2/3/4-bit",
  "固定 bit，混合量化方法": "Fixed bit, search quantization methods",
  "目标精度": "Target precision",
  "平均约 3bit": "Average 3-bit",
  "固定 3bit": "Fixed 3-bit",
  "自定义约束": "Custom constraint",
  "候选基座模型": "Base model",
  "量化线性层来源": "Quantized layer sources",
  "量化方法": "Quantization method",
  "上一步": "Back",
  "设定硬件、优化偏好与交付内容": "Set hardware, optimization preference, and deliverables",
  "选择硬件限制和优化方向，我们会据此筛选更合适的候选配置。": "Choose the hardware limit and optimization direction used to rank candidate configurations.",
  "目标硬件": "Target hardware",
  "显存上限": "Memory limit",
  "交付物": "Deliverable",
  "配置 JSON": "Config JSON",
  "HF 拉取清单": "HF manifest",
  "部署 recipe": "Deployment recipe",
  "全部": "All deliverables",
  "优化偏好": "Optimization preference",
  "均衡": "Balanced",
  "兼顾质量、显存与速度": "Balance quality, memory, and speed",
  "质量优先": "Quality first",
  "优先保留任务性能": "Prioritize task performance",
  "显存优先": "Memory first",
  "优先降低模型占用": "Prioritize a smaller memory footprint",
  "延迟优先": "Latency first",
  "优先降低推理延迟": "Prioritize lower inference latency",
  "确认需求并留下结果邮箱": "Review the request and enter your email",
  "提交后会收到确认邮件，正式结果以 JSON 附件交付。": "You will receive a confirmation email, followed by the final JSON as an attachment.",
  "结果接收邮箱": "Result email",
  "我同意 QuantNAS Studio 保存本次需求和邮箱，用于请求处理、进度通知与结果交付。 未经额外许可，不公开用户邮箱和任务描述。": "I agree that QuantNAS Studio may store this request and email address for processing, notifications, and result delivery. Email addresses and task descriptions will not be published without permission.",
  "提交后请检查确认邮件。正式结果会以 JSON 附件发送，请保留邮件中的请求编号。": "Check your confirmation email after submission and keep the request ID for future correspondence.",
  "提交搜索需求": "Submit request",
  "请求预览": "Request Preview",
  "请求摘要": "Request Summary",
  "提交状态": "Submission Status",
  "高级请求 JSON": "Advanced request JSON",
  "填写需求后提交，我们会通过邮件确认。": "Complete the questionnaire and submit it to receive an email confirmation.",
  "需求已进入处理队列": "Your request is in the processing queue",
  "请检查确认邮件并保存请求编号。搜索完成后，结果 JSON 会发送到提交邮箱。": "Check the confirmation email and keep your request ID. The result JSON will be sent to the submitted email address.",
  "复制请求 JSON": "Copy request JSON",
  "下载 request.json": "Download request.json",
  "这里集中放置项目源码、实验室主页和联系邮箱。论文公开后会补充正式链接。": "Project source code, lab information, and contact details are collected here. The paper link will be added after release.",
  "项目源码与 GitHub Pages 部署仓库": "Source code and GitHub Pages repository",
  "占位链接，等待正式论文": "Placeholder link pending the paper release",
  "如果你想试用量化层组合搜索、复现实验或讨论合作，可以通过以下邮箱联系。": "Contact us to try quantized layer composition search, reproduce experiments, or discuss collaboration.",
  "量化层组合可视化": "Quantized layer composition visualization",
  "候选组合摘要": "Candidate composition summary",
  "NAS 搜索阶段": "NAS search stages",
  "问卷进度": "Questionnaire progress",
  "主导航": "Main navigation",
  "支持的模型列表": "Supported model list"
};

function captureLocalizedContent() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    const key = value.trim().replace(/\s+/g, " ");
    if (staticTranslations[key]) {
      state.localizedTextNodes.push({ node, key, prefix: value.match(/^\s*/)[0], suffix: value.match(/\s*$/)[0] });
    }
    node = walker.nextNode();
  }

  document.querySelectorAll("[placeholder], [aria-label]").forEach((element) => {
    ["placeholder", "aria-label"].forEach((attribute) => {
      const key = element.getAttribute(attribute);
      if (key && staticTranslations[key]) {
        state.localizedAttributes.push({ element, attribute, key });
      }
    });
  });
}

function applyLanguage(language) {
  state.language = language;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  state.localizedTextNodes.forEach(({ node, key, prefix, suffix }) => {
    node.nodeValue = `${prefix}${language === "en" ? staticTranslations[key] : key}${suffix}`;
  });
  state.localizedAttributes.forEach(({ element, attribute, key }) => {
    element.setAttribute(attribute, language === "en" ? staticTranslations[key] : key);
  });
  elements.languageToggle.textContent = language === "en" ? "中文" : "English";
  elements.languageToggle.setAttribute("aria-label", language === "en" ? "切换到中文" : "Switch to English");
  updateThemeControl();
  updateDatasetUrlRequirement();
  updateSearchModeControls();
  if (state.currentStep === elements.formSteps.length) {
    renderReviewSummary();
  }
  if (state.lastResult) {
    renderReceipt(state.lastResult, { scroll: false });
  }
}

function updateThemeControl() {
  if (!elements.themeToggle) {
    return;
  }
  const isNight = state.theme === "night";
  const label = isNight ? themeText[state.language].toDay : themeText[state.language].toNight;
  elements.themeToggle.setAttribute("aria-label", label);
  elements.themeToggle.setAttribute("title", label);
  elements.themeToggle.setAttribute("aria-pressed", (!isNight).toString());
}

function applyTheme(theme, { persist = true, preserveScroll = true } = {}) {
  const nextTheme = theme === "day" ? "day" : "night";
  const anchorLine = Math.min(160, window.innerHeight * 0.25);
  const pageSections = preserveScroll
    ? Array.from(document.querySelectorAll("#workflow, #models, #request, #result-section:not([hidden]), #contact"))
    : [];
  const pageAnchor = pageSections.find((section) => {
    const bounds = section.getBoundingClientRect();
    return bounds.top <= anchorLine && bounds.bottom > anchorLine;
  }) || pageSections
    .filter((section) => {
      const bounds = section.getBoundingClientRect();
      return bounds.top < window.innerHeight && bounds.bottom > 0;
    })
    .sort((left, right) => (
      Math.abs(left.getBoundingClientRect().top - anchorLine) - Math.abs(right.getBoundingClientRect().top - anchorLine)
    ))[0];
  const anchorOffset = pageAnchor?.getBoundingClientRect().top;
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme === "day" ? "light" : "dark";
  if (elements.dayThemeStylesheet) {
    elements.dayThemeStylesheet.disabled = nextTheme !== "day";
  }
  if (persist) {
    try {
      window.localStorage.setItem("quantnas-theme", nextTheme);
    } catch (error) {
      // Theme persistence is optional when storage is unavailable.
    }
  }
  updateThemeControl();
  const activeHero = document.querySelector(".theme-hero");
  activeHero?.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
  document.dispatchEvent(new CustomEvent("quantnas:themechange", { detail: { theme: nextTheme } }));
  if (pageAnchor && anchorOffset !== undefined) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollBy(0, pageAnchor.getBoundingClientRect().top - anchorOffset);
      });
    });
  }
}

function setupThemeToggle() {
  elements.themeToggle?.addEventListener("click", () => {
    applyTheme(state.theme === "night" ? "day" : "night");
  });
}

function renderChipGroup(container, items, selectedSet, onToggle) {
  container.innerHTML = "";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-chip";
    button.textContent = item;
    button.setAttribute("aria-pressed", selectedSet.has(item).toString());
    button.addEventListener("click", () => {
      onToggle(item);
      renderChipGroup(container, items, selectedSet, onToggle);
      updatePreview();
    });
    container.append(button);
  });
}

function renderSingleChipGroup(container, items, selectedValue, onSelect) {
  container.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-chip";
    button.textContent = item;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", (selectedValue === item).toString());
    button.addEventListener("click", () => {
      onSelect(item);
      renderSingleChipGroup(container, items, item, onSelect);
      updatePreview();
    });
    container.append(button);
  });
}

function toggleSelected(set, value, minimumSize = 1) {
  if (set.has(value) && set.size > minimumSize) {
    set.delete(value);
    return;
  }

  set.add(value);
}

function getActiveQuantizers() {
  if (elements.searchMode.value === "fixed_method_mixed_bit") {
    return [state.fixedMethodQuantizer];
  }
  return Array.from(state.selectedQuantizers);
}

function renderQuantizerChoices() {
  if (elements.searchMode.value === "fixed_method_mixed_bit") {
    renderSingleChipGroup(elements.quantizerChips, quantizers, state.fixedMethodQuantizer, (quantizer) => {
      state.fixedMethodQuantizer = quantizer;
    });
    return;
  }

  renderChipGroup(elements.quantizerChips, quantizers, state.selectedQuantizers, (quantizer) => {
    toggleSelected(state.selectedQuantizers, quantizer, 2);
  });
}

function updateSearchModeControls() {
  const isBitMix = elements.searchMode.value === "fixed_method_mixed_bit";
  const previousPrecision = elements.targetPrecision.value;
  const precisionOptions = isBitMix
    ? [{ value: "avg_3bit", en: "Average 3-bit", zh: "平均约 3bit" }]
    : [
        { value: "2bit", en: "Fixed 2-bit", zh: "固定 2bit" },
        { value: "3bit", en: "Fixed 3-bit", zh: "固定 3bit" },
        { value: "4bit", en: "Fixed 4-bit", zh: "固定 4bit" }
      ];

  elements.targetPrecision.replaceChildren();
  precisionOptions.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item[state.language];
    elements.targetPrecision.append(option);
  });
  const validPrevious = precisionOptions.some((item) => item.value === previousPrecision);
  elements.targetPrecision.value = validPrevious ? previousPrecision : (isBitMix ? "avg_3bit" : "3bit");

  if (state.language === "en") {
    elements.quantizerLegend.textContent = isBitMix ? "Quantization method" : "Quantization methods";
    elements.quantizerHelp.textContent = isBitMix ? "Select exactly one method." : "Select at least two methods.";
  } else {
    elements.quantizerLegend.textContent = isBitMix ? "量化方法" : "量化方法（多选）";
    elements.quantizerHelp.textContent = isBitMix ? "请选择一种方法。" : "请至少选择两种方法。";
  }

  renderQuantizerChoices();
  updatePreview();
}

function getFormPayload() {
  const formData = new FormData(elements.form);
  const benchmark = formData.get("projectName") || "svamp";
  const benchmarkLabel = benchmarkLabels[benchmark]?.[state.language] || benchmark;

  return {
    schema_version: "1.0",
    request_id: state.requestId,
    project_name: benchmarkLabel,
    task_type: benchmark,
    task_label: benchmarkLabel,
    search_mode: formData.get("searchMode"),
    target_precision: formData.get("targetPrecision"),
    task_description: formData.get("taskDescription") || "",
    dataset_hint: formData.get("datasetHint") || "",
    dataset_url: formData.get("datasetUrl") || "",
    candidate_base_models: [state.selectedModel],
    quantized_layer_sources: getActiveQuantizers(),
    constraints: {
      hardware: formData.get("hardware"),
      memory_cap_gb: Number(formData.get("memoryCap")),
      optimization_preference: formData.get("optimizationPreference")
    },
    deliverable: formData.get("deliverable"),
    contact_email: formData.get("contactEmail") || "",
    privacy_consent: formData.get("privacyConsent") === "on",
    consent_version: "2026-07-19",
    channel_version: channelConfig.channelVersion || "1.0.0",
    requested_at: new Date().toISOString(),
    page_url: window.location.href.split("#")[0]
  };
}

function updateDatasetUrlRequirement() {
  const isOtherTask = elements.projectName.value === "other";
  elements.datasetUrlField.hidden = !isOtherTask;
  elements.datasetUrl.required = isOtherTask;
  elements.datasetUrlHelp.hidden = !isOtherTask;
  elements.datasetUrl.setCustomValidity("");
  if (!isOtherTask) {
    elements.datasetUrl.value = "";
  }
  if (isOtherTask && !elements.datasetUrl.value.trim()) {
    elements.datasetUrl.setCustomValidity(uiText[state.language].otherUrlRequired);
  }
}

function updatePreview() {
  const payload = getFormPayload();
  elements.preview.textContent = JSON.stringify(payload, null, 2);
  renderLiveSummary(payload);
}

function appendReviewItem(container, label, value) {
  const item = document.createElement("div");
  const term = document.createElement("span");
  const detail = document.createElement("strong");
  term.textContent = label;
  detail.textContent = value || (state.language === "en" ? "Not provided" : "未填写");
  item.append(term, detail);
  container.append(item);
}

function getSelectedOptionText(id) {
  const select = document.querySelector(`#${id}`);
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function getOptimizationPreferenceText() {
  const selected = elements.form.querySelector('input[name="optimizationPreference"]:checked');
  return selected?.closest("label")?.querySelector("strong")?.textContent?.trim() || "";
}

function renderLiveSummary(payload) {
  const labels = state.language === "en"
    ? { task: "Task", model: "Model", search: "Search", precision: "Precision", sources: "Sources", preference: "Preference" }
    : { task: "任务", model: "模型", search: "搜索", precision: "精度", sources: "方法", preference: "偏好" };
  elements.liveSummary.replaceChildren();
  appendReviewItem(elements.liveSummary, labels.task, payload.task_label);
  appendReviewItem(elements.liveSummary, labels.model, payload.candidate_base_models[0]);
  appendReviewItem(elements.liveSummary, labels.search, getSelectedOptionText("searchMode"));
  appendReviewItem(elements.liveSummary, labels.precision, getSelectedOptionText("targetPrecision"));
  appendReviewItem(elements.liveSummary, labels.sources, payload.quantized_layer_sources.join(", "));
  appendReviewItem(elements.liveSummary, labels.preference, getOptimizationPreferenceText());
}

function renderReviewSummary() {
  const payload = getFormPayload();
  const labels = state.language === "en"
    ? { task: "Task", mode: "Search mode", model: "Base model", sources: "Quantized sources", constraints: "Constraints", preference: "Preference", delivery: "Deliverable" }
    : { task: "任务", mode: "搜索方式", model: "基座模型", sources: "量化来源", constraints: "资源约束", preference: "优化偏好", delivery: "交付" };
  elements.reviewSummary.replaceChildren();
  appendReviewItem(elements.reviewSummary, labels.task, payload.task_label);
  appendReviewItem(elements.reviewSummary, labels.mode, getSelectedOptionText("searchMode"));
  appendReviewItem(elements.reviewSummary, labels.model, payload.candidate_base_models.join(", "));
  appendReviewItem(elements.reviewSummary, labels.sources, payload.quantized_layer_sources.join(", "));
  appendReviewItem(
    elements.reviewSummary,
    labels.constraints,
    `${getSelectedOptionText("hardware")} · ${payload.constraints.memory_cap_gb} GB · ${getSelectedOptionText("targetPrecision")}`
  );
  appendReviewItem(elements.reviewSummary, labels.preference, getOptimizationPreferenceText());
  appendReviewItem(elements.reviewSummary, labels.delivery, getSelectedOptionText("deliverable"));
}

function validateStep(step) {
  const section = elements.formSteps.find((item) => Number(item.dataset.formStep) === step);
  if (!section) {
    return false;
  }

  const fields = Array.from(section.querySelectorAll("input, select, textarea"));
  const invalidField = fields.find((field) => !field.checkValidity());
  if (invalidField) {
    invalidField.reportValidity();
    invalidField.focus({ preventScroll: true });
    invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  return true;
}

function showFormStep(step, { validateCurrent = false } = {}) {
  const nextStep = Math.min(Math.max(Number(step), 1), elements.formSteps.length);
  if (validateCurrent && nextStep > state.currentStep && !validateStep(state.currentStep)) {
    return;
  }
  if (nextStep > state.maxVisitedStep + 1) {
    return;
  }

  state.currentStep = nextStep;
  state.maxVisitedStep = Math.max(state.maxVisitedStep, nextStep);
  elements.formSteps.forEach((section) => {
    section.hidden = Number(section.dataset.formStep) !== nextStep;
  });
  elements.wizardSteps.forEach((button, index) => {
    const buttonStep = index + 1;
    const isActive = buttonStep === nextStep;
    button.disabled = buttonStep > state.maxVisitedStep;
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-complete", buttonStep < state.maxVisitedStep);
    if (isActive) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  elements.wizardProgressBar.style.transform = `scaleX(${nextStep / elements.formSteps.length})`;

  if (nextStep === elements.formSteps.length) {
    renderReviewSummary();
  }
}

function setProgress(percent, label) {
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.transform = `scaleX(${Math.min(Math.max(percent, 0), 100) / 100})`;
  elements.progressLabel.textContent = label;
}

function getSubmissionEndpoint() {
  const configured = String(channelConfig.appsScriptWebAppUrl || "").trim();
  if (configured) {
    return configured;
  }

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "/api/requests";
  }

  return "";
}

async function submitRequest(payload) {
  const endpoint = getSubmissionEndpoint();
  if (!endpoint) {
    throw new Error(uiText[state.language].endpointMissing);
  }

  setProgress(22, uiText[state.language].transmitting);

  const isAppsScript = endpoint.includes("script.google.com");
  const requestPromise = fetch(endpoint, {
    method: "POST",
    mode: isAppsScript ? "no-cors" : "cors",
    headers: {
      "Content-Type": isAppsScript ? "text/plain;charset=utf-8" : "application/json"
    },
    body: JSON.stringify({
      ...payload,
      website: document.querySelector("#website").value
    })
  }).then((response) => ({ response })).catch((error) => ({ error }));

  setProgress(55, uiText[state.language].processing);
  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve({ timedOut: true }), 18000);
  });
  const requestResult = await Promise.race([requestPromise, timeoutPromise]);

  if (requestResult.timedOut && isAppsScript) {
    setProgress(100, uiText[state.language].pending);
    return {
      schema_version: "1.0",
      request_id: payload.request_id,
      status: "pending_confirmation",
      submitted_at: new Date().toISOString(),
      contact_email: payload.contact_email,
      deliverable: payload.deliverable,
      message: uiText[state.language].pending,
      request: payload
    };
  }

  if (requestResult.error) {
    throw requestResult.error;
  }

  const response = requestResult.response;

  if (!isAppsScript && !response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request API returned ${response.status}`);
  }

  const serverReceipt = isAppsScript ? null : await response.json();
  setProgress(100, uiText[state.language].sent);

  return {
    schema_version: "1.0",
    request_id: serverReceipt?.request_id || payload.request_id,
    status: serverReceipt?.status || "submitted",
    submitted_at: serverReceipt?.submitted_at || new Date().toISOString(),
    contact_email: payload.contact_email,
    deliverable: payload.deliverable,
    message: uiText[state.language].receiptMessage,
    request: payload
  };
}

function appendMetric(label, value) {
  const item = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = value;
  item.append(strong, document.createTextNode(label));
  elements.resultMetrics.append(item);
}

function renderReceipt(receipt, { scroll = true } = {}) {
  state.lastResult = receipt;
  elements.resultSection.hidden = false;
  elements.resultJson.textContent = JSON.stringify(receipt, null, 2);
  elements.resultCopy.textContent = uiText[state.language].receiptCopy(receipt);
  elements.resultMetrics.replaceChildren();
  appendMetric("Request ID", receipt.request_id);
  appendMetric("Status", receipt.status.toUpperCase());
  appendMetric("Delivery", uiText[state.language].delivery);
  appendMetric("Email", receipt.contact_email);
  if (scroll) {
    elements.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function copyResult() {
  if (!state.lastResult) {
    return;
  }

  const content = JSON.stringify(state.lastResult, null, 2);
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  elements.copyButton.textContent = uiText[state.language].copied;
  window.setTimeout(() => {
    elements.copyButton.textContent = uiText[state.language].copyRequest;
  }, 1600);
}

function downloadResult() {
  if (!state.lastResult) {
    return;
  }

  const content = JSON.stringify(state.lastResult, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.lastResult.request_id || "quantnas-request"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function setupRevealAnimation() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function setupHeroLossAnimation() {
  const lossValues = document.querySelectorAll("[data-hero-loss]");
  const trialValue = document.querySelector("#hero-trial");
  const traceSteps = document.querySelectorAll(".trace-step");
  if (lossValues.length === 0) {
    return;
  }

  const values = [1.86, 1.48, 1.12, 0.83, 0.61, 0.42];
  let index = 0;
  let trial = 184;
  const tick = () => {
    lossValues.forEach((lossValue) => {
      lossValue.textContent = values[index].toFixed(2);
    });
    if (trialValue) {
      trialValue.textContent = String(trial).padStart(4, "0");
    }
    if (traceSteps.length > 0) {
      traceSteps.forEach((step, stepIndex) => {
        step.classList.toggle("is-active", stepIndex === index % traceSteps.length);
      });
    }
    if (trial >= 9700) {
      trial = 184;
      index = 0;
    } else {
      trial += index === 0 ? 37 : 37 + index * 3;
      index = Math.min(index + 1, values.length - 1);
    }
  };

  tick();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(tick, 800);
  }
}

function setupNasNetworkCanvas() {
  const canvas = document.querySelector("#nas-network-canvas");
  const hero = canvas?.closest(".hero");
  const context = canvas?.getContext("2d");
  if (!canvas || !hero || !context) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const themePalettes = {
    night: {
      nodes: ["#70f1bd", "#72d9ff", "#f3c969", "#ff7d73"],
      edgeRgb: "182, 218, 204",
      edgeBase: 0.035,
      edgePulse: 0.045,
      edgeRange: 0.035,
      nodeAlpha: 0.38,
      nodeAlphaRange: 0.48,
      shadowBase: 8,
      shadowRange: 11
    },
    day: {
      nodes: ["#138269", "#168bb3", "#b77912", "#d9564e"],
      edgeRgb: "18, 83, 73",
      edgeBase: 0.055,
      edgePulse: 0.06,
      edgeRange: 0.045,
      nodeAlpha: 0.44,
      nodeAlphaRange: 0.46,
      shadowBase: 4,
      shadowRange: 8
    }
  };
  let width = 0;
  let height = 0;
  let nodes = [];
  let edges = [];
  let particles = [];
  let animationFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  const getThemePalette = () => themePalettes[document.documentElement.dataset.theme] || themePalettes.night;

  const seededUnit = (seed) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  const rebuildScene = () => {
    const palette = getThemePalette().nodes;
    nodes = [];
    edges = [];
    particles = [];

    const columnCount = width < 760 ? 7 : 11;
    const rowCount = width < 760 ? 7 : 8;
    const startX = width < 760 ? width * 0.08 : width * 0.38;
    const endX = width * 1.02;
    const top = height * 0.1;
    const bottom = height * 0.88;
    const columns = [];

    for (let column = 0; column < columnCount; column += 1) {
      const columnNodes = [];
      const progress = column / Math.max(columnCount - 1, 1);
      const x = startX + (endX - startX) * progress;

      for (let row = 0; row < rowCount; row += 1) {
        const seed = column * 31 + row * 7 + 3;
        const baseY = top + ((bottom - top) * row) / Math.max(rowCount - 1, 1);
        const y = baseY + (seededUnit(seed) - 0.5) * Math.min(34, height * 0.045);
        const node = {
          x,
          y,
          color: palette[(column + row * 2) % palette.length],
          phase: seededUnit(seed + 9) * Math.PI * 2,
          size: 2.5 + seededUnit(seed + 16) * 2.8
        };
        nodes.push(node);
        columnNodes.push(node);
      }
      columns.push(columnNodes);
    }

    for (let column = 0; column < columns.length - 1; column += 1) {
      columns[column].forEach((from, row) => {
        const offsets = row % 3 === 0 ? [0, 1, -1] : [0, row % 2 === 0 ? 1 : -1];
        offsets.forEach((offset, offsetIndex) => {
          const to = columns[column + 1][row + offset];
          if (to) {
            edges.push({
              from,
              to,
              strength: offsetIndex === 0 ? 1 : 0.38,
              phase: seededUnit(column * 53 + row * 11 + offsetIndex) * Math.PI * 2
            });
          }
        });
      });
    }

    const particleCount = width < 760 ? 8 : 16;
    for (let index = 0; index < particleCount; index += 1) {
      particles.push({
        edge: Math.floor(seededUnit(index + 41) * edges.length),
        progress: seededUnit(index + 87),
        speed: 0.035 + seededUnit(index + 126) * 0.035,
        color: palette[index % palette.length]
      });
    }
  };

  const resize = () => {
    const bounds = hero.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    rebuildScene();
  };

  const draw = (timestamp = 0) => {
    const palette = getThemePalette();
    const time = timestamp * 0.001;
    pointerX += (targetPointerX - pointerX) * 0.035;
    pointerY += (targetPointerY - pointerY) * 0.035;
    context.clearRect(0, 0, width, height);

    const offsetX = pointerX * 12;
    const offsetY = pointerY * 8;

    edges.forEach((edge) => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.9 + edge.phase);
      context.beginPath();
      context.moveTo(edge.from.x + offsetX, edge.from.y + offsetY);
      context.lineTo(edge.to.x + offsetX, edge.to.y + offsetY);
      context.strokeStyle = `rgba(${palette.edgeRgb}, ${palette.edgeBase + edge.strength * (palette.edgePulse + pulse * palette.edgeRange)})`;
      context.lineWidth = edge.strength > 0.5 ? 0.8 : 0.45;
      context.stroke();
    });

    particles.forEach((particle) => {
      const edge = edges[particle.edge];
      if (!edge) {
        return;
      }
      if (!reducedMotion.matches) {
        particle.progress += particle.speed * 0.016;
        if (particle.progress > 1) {
          particle.progress = 0;
          particle.edge = (particle.edge + 17) % edges.length;
        }
      }
      const x = edge.from.x + (edge.to.x - edge.from.x) * particle.progress + offsetX;
      const y = edge.from.y + (edge.to.y - edge.from.y) * particle.progress + offsetY;
      context.save();
      context.shadowBlur = 14;
      context.shadowColor = particle.color;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(x, y, 1.8, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    nodes.forEach((node) => {
      const pulse = reducedMotion.matches ? 0.45 : 0.5 + 0.5 * Math.sin(time * 1.15 + node.phase);
      const x = node.x + offsetX;
      const y = node.y + offsetY;
      context.save();
      context.globalAlpha = palette.nodeAlpha + pulse * palette.nodeAlphaRange;
      context.shadowBlur = palette.shadowBase + pulse * palette.shadowRange;
      context.shadowColor = node.color;
      context.fillStyle = node.color;
      context.fillRect(x - node.size / 2, y - node.size / 2, node.size, node.size);
      context.restore();
    });

    if (!reducedMotion.matches) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  };

  const handlePointerMove = (event) => {
    const bounds = hero.getBoundingClientRect();
    targetPointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    targetPointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  };

  const handlePointerLeave = () => {
    targetPointerX = 0;
    targetPointerY = 0;
  };

  const handleMotionPreference = () => {
    window.cancelAnimationFrame(animationFrame);
    draw(performance.now());
  };

  const handleResize = () => {
    resize();
    if (reducedMotion.matches) {
      draw(performance.now());
    }
  };

  const handleThemeChange = () => {
    window.cancelAnimationFrame(animationFrame);
    resize();
    draw(performance.now());
  };

  resize();
  draw(performance.now());
  hero.addEventListener("pointermove", handlePointerMove, { passive: true });
  hero.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("resize", handleResize, { passive: true });
  reducedMotion.addEventListener("change", handleMotionPreference);
  document.addEventListener("quantnas:themechange", handleThemeChange);
}

function setupForm() {
  renderSingleChipGroup(elements.modelChips, baseModels, state.selectedModel, (model) => {
    state.selectedModel = model;
  });

  elements.form.addEventListener("input", () => {
    updateDatasetUrlRequirement();
    updatePreview();
  });
  elements.projectName.addEventListener("change", updateDatasetUrlRequirement);
  elements.searchMode.addEventListener("change", updateSearchModeControls);
  elements.languageToggle.addEventListener("click", () => {
    applyLanguage(state.language === "en" ? "zh" : "en");
  });
  elements.form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && state.currentStep < elements.formSteps.length && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
      showFormStep(state.currentStep + 1, { validateCurrent: true });
    }
  });
  elements.form.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => showFormStep(state.currentStep + 1, { validateCurrent: true }));
  });
  elements.form.querySelectorAll("[data-previous-step]").forEach((button) => {
    button.addEventListener("click", () => showFormStep(state.currentStep - 1));
  });
  elements.wizardSteps.forEach((button) => {
    button.addEventListener("click", () => showFormStep(Number(button.dataset.stepTarget)));
  });
  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.currentStep !== elements.formSteps.length) {
      showFormStep(state.currentStep + 1, { validateCurrent: true });
      return;
    }
    if (!validateStep(state.currentStep)) {
      return;
    }

    const submitButton = elements.form.querySelector(".submit-button");
    const submitLabel = submitButton.querySelector("span");
    const payload = getFormPayload();

    if (document.querySelector("#website").value) {
      setProgress(0, uiText[state.language].invalid);
      return;
    }

    submitButton.disabled = true;
    submitLabel.textContent = uiText[state.language].sending;
    setProgress(8, uiText[state.language].validating);

    try {
      const receipt = await submitRequest(payload);
      renderReceipt(receipt);
    } catch (error) {
      setProgress(0, `${uiText[state.language].failedPrefix}${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = uiText[state.language].submit;
    }
  });

  elements.copyButton.addEventListener("click", copyResult);
  elements.downloadButton.addEventListener("click", downloadResult);
  updateDatasetUrlRequirement();
  updateSearchModeControls();
  showFormStep(1);
}

captureLocalizedContent();
setupRevealAnimation();
setupHeroLossAnimation();
setupNasNetworkCanvas();
setupThemeToggle();
setupForm();
applyLanguage("en");
applyTheme(state.theme, { persist: false, preserveScroll: false });
