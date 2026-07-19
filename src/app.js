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

function createRequestId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = new Uint32Array(1);
  window.crypto.getRandomValues(random);
  return `QNAS-${date}-${random[0].toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

const state = {
  selectedModel: "Qwen3-8B",
  selectedQuantizers: new Set(quantizers),
  requestId: createRequestId(),
  lastResult: null,
  currentStep: 1,
  maxVisitedStep: 1,
  language: "en",
  localizedTextNodes: [],
  localizedAttributes: []
};

const elements = {
  form: document.querySelector("#nas-form"),
  modelChips: document.querySelector("#model-chips"),
  quantizerChips: document.querySelector("#quantizer-chips"),
  preview: document.querySelector("#payload-preview"),
  latencyInput: document.querySelector("#latencyPriority"),
  latencyValue: document.querySelector("#latencyValue"),
  qualityInput: document.querySelector("#qualityFloor"),
  qualityValue: document.querySelector("#qualityValue"),
  languageToggle: document.querySelector("#language-toggle"),
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
  "基于 ParoQuant、GPTAQ、SlimLLM、LRQ+ 等量化结果，面向 Qwen、Llama 系列模型进行逐层组合搜索。用户只需要描述任务、约束与评测数据，我们在后端返回最优组合配置文件。": "Compose quantized linear layers from ParoQuant, GPTAQ, SlimLLM, and LRQ+ for Qwen and Llama models. Describe your benchmark and constraints, and we will return the searched configuration.",
  "提交 NAS 任务": "Submit NAS Request",
  "查看工作流": "View Workflow",
  "从任务需求到 Hugging Face 拉取清单": "From task request to Hugging Face manifest",
  "页面先收集任务、模型池、量化方法和资源约束；后端可以接入真实 NAS 服务，返回组合配置、线性层来源和复现实验参数。": "The questionnaire collects the task, model pool, quantization methods, and resource constraints. Our NAS backend returns the composition config, per-linear sources, and reproducible evaluation metadata.",
  "任务画像": "Task Profile",
  "收集任务类型、数据域、指标偏好、质量下限、显存和延迟约束。": "Select a benchmark and specify evaluation, quality, memory, and latency constraints.",
  "搜索空间构建": "Search Space",
  "在 Qwen2.5、Qwen3、Llama2、Llama3.1 等模型的量化线性层池中构造候选。": "Build candidates from quantized linear-layer banks for Qwen and Llama model families.",
  "NAS 评估": "NAS Evaluation",
  "后端按任务评测集和硬件约束搜索 layer-level 组合，输出 Pareto 最优配置。": "Search layer-wise compositions under benchmark and hardware constraints, then select the best validated configuration.",
  "配置交付": "Config Delivery",
  "返回 JSON 配置、HF layer pull manifest、部署提示和可复现实验元数据。": "Receive a JSON config, HF layer manifest, deployment notes, and reproducible experiment metadata.",
  "覆盖主流开源大模型家族": "Major open-source model families",
  "原型里已经预置你们描述的模型与量化器选项，后续可以直接从后端接口或 HF repo manifest 动态加载。": "Choose from the model families and quantizers currently covered by our experiments and layer warehouse.",
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
  "基座模型只能单选，量化线性层来源可以多选。": "Select one base model and one or more quantization sources for the search space.",
  "搜索模式": "Search mode",
  "固定方法，混合 2/3/4bit": "Fixed method, search 2/3/4-bit",
  "固定 bit，混合量化方法": "Fixed bit, search quantization methods",
  "目标精度": "Target precision",
  "平均约 3bit": "Average 3-bit",
  "固定 3bit": "Fixed 3-bit",
  "自定义约束": "Custom constraint",
  "候选基座模型": "Base model",
  "量化线性层来源": "Quantized layer sources",
  "上一步": "Back",
  "设定硬件、质量与交付约束": "Set hardware, quality, and delivery constraints",
  "这些约束会决定我们优先搜索更低显存、更高质量或更低延迟的配置。": "These constraints guide the search toward lower memory, higher quality, or lower latency.",
  "目标硬件": "Target hardware",
  "显存上限": "Memory limit",
  "交付物": "Deliverable",
  "配置 JSON": "Config JSON",
  "HF 拉取清单": "HF manifest",
  "部署 recipe": "Deployment recipe",
  "全部": "All deliverables",
  "延迟优先级": "Latency priority",
  "质量保留下限": "Minimum quality retention",
  "确认需求并留下结果邮箱": "Review the request and enter your email",
  "提交后会收到确认邮件，正式结果以 JSON 附件交付。": "You will receive a confirmation email, followed by the final JSON as an attachment.",
  "结果接收邮箱": "Result email",
  "我同意 QuantNAS Studio 保存本次需求和邮箱，用于请求处理、进度通知与结果交付。 未经额外许可，不公开用户邮箱和任务描述。": "I agree that QuantNAS Studio may store this request and email address for processing, notifications, and result delivery. Email addresses and task descriptions will not be published without permission.",
  "提交后请检查确认邮件。正式结果会以 JSON 附件发送，请保留邮件中的请求编号。": "Check your confirmation email after submission and keep the request ID for future correspondence.",
  "提交搜索需求": "Submit request",
  "请求预览": "Request Preview",
  "填写需求后提交，我们会通过邮件确认。": "Complete the questionnaire and submit it to receive an email confirmation.",
  "需求已进入处理队列": "Your request is in the processing queue",
  "请检查确认邮件并保存请求编号。搜索完成后，结果 JSON 会发送到提交邮箱。": "Check the confirmation email and keep your request ID. The result JSON will be sent to the submitted email address.",
  "复制请求 JSON": "Copy request JSON",
  "下载 request.json": "Download request.json",
  "这里会集中放置项目论文、开源代码、实验室主页和联系邮箱。GitHub 与 arXiv 暂时使用占位地址，后续替换为正式链接即可。": "Project papers, source code, lab information, and contact details are collected here.",
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
  updateDatasetUrlRequirement();
  updatePreview();
  if (state.currentStep === elements.formSteps.length) {
    renderReviewSummary();
  }
  if (state.lastResult) {
    renderReceipt(state.lastResult, { scroll: false });
  }
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
      renderSingleChipGroup(container, items, state.selectedModel, onSelect);
      updatePreview();
    });
    container.append(button);
  });
}

function toggleSelected(set, value) {
  if (set.has(value) && set.size > 1) {
    set.delete(value);
    return;
  }

  set.add(value);
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
    quantized_layer_sources: Array.from(state.selectedQuantizers),
    constraints: {
      hardware: formData.get("hardware"),
      memory_cap_gb: Number(formData.get("memoryCap")),
      latency_priority: Number(formData.get("latencyPriority")),
      quality_floor_percent: Number(formData.get("qualityFloor"))
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
  if (isOtherTask && !elements.datasetUrl.value.trim()) {
    elements.datasetUrl.setCustomValidity(uiText[state.language].otherUrlRequired);
  }
}

function updatePreview() {
  elements.latencyValue.textContent = elements.latencyInput.value;
  elements.qualityValue.textContent = elements.qualityInput.value;
  elements.preview.textContent = JSON.stringify(getFormPayload(), null, 2);
}

function appendReviewItem(container, label, value) {
  const item = document.createElement("div");
  const term = document.createElement("span");
  const detail = document.createElement("strong");
  term.textContent = label;
  detail.textContent = value || "未填写";
  item.append(term, detail);
  container.append(item);
}

function getSelectedOptionText(id) {
  const select = document.querySelector(`#${id}`);
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function renderReviewSummary() {
  const payload = getFormPayload();
  const labels = state.language === "en"
    ? { task: "Task", mode: "Search mode", model: "Base model", sources: "Quantized sources", constraints: "Constraints", delivery: "Deliverable" }
    : { task: "任务", mode: "搜索方式", model: "基座模型", sources: "量化来源", constraints: "资源约束", delivery: "交付" };
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
  elements.wizardProgressBar.style.width = `${(nextStep / elements.formSteps.length) * 100}%`;

  if (nextStep === elements.formSteps.length) {
    renderReviewSummary();
  }
}

function setProgress(percent, label) {
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
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
  const lossValue = document.querySelector("#hero-loss");
  const traceSteps = document.querySelectorAll(".trace-step");
  if (!lossValue || traceSteps.length === 0) {
    return;
  }

  const values = [1.86, 1.48, 1.12, 0.83, 0.61, 0.42];
  let index = 0;
  const tick = () => {
    lossValue.textContent = values[index].toFixed(2);
    traceSteps.forEach((step, stepIndex) => {
      step.classList.toggle("is-active", stepIndex === index % traceSteps.length);
    });
    index = (index + 1) % values.length;
  };

  tick();
  window.setInterval(tick, 800);
}

function setupForm() {
  renderSingleChipGroup(elements.modelChips, baseModels, state.selectedModel, (model) => {
    state.selectedModel = model;
  });
  renderChipGroup(elements.quantizerChips, quantizers, state.selectedQuantizers, (quantizer) => {
    toggleSelected(state.selectedQuantizers, quantizer);
  });

  elements.form.addEventListener("input", () => {
    updateDatasetUrlRequirement();
    updatePreview();
  });
  elements.projectName.addEventListener("change", updateDatasetUrlRequirement);
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
  showFormStep(1);
  updatePreview();
}

captureLocalizedContent();
setupRevealAnimation();
setupHeroLossAnimation();
setupForm();
applyLanguage("en");
