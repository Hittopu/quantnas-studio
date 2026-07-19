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

const taskLabels = {
  long_context_qa: "长上下文问答",
  code_generation: "代码生成",
  math_reasoning: "数学推理",
  instruction_following: "指令遵循",
  domain_rag: "领域 RAG",
  custom: "自定义任务"
};

function createRequestId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = new Uint32Array(1);
  window.crypto.getRandomValues(random);
  return `QNAS-${date}-${random[0].toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

const state = {
  selectedModels: new Set(["Qwen3-8B", "Qwen3-32B"]),
  selectedQuantizers: new Set(quantizers),
  requestId: createRequestId(),
  lastResult: null,
  currentStep: 1,
  maxVisitedStep: 1
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

function toggleSelected(set, value) {
  if (set.has(value) && set.size > 1) {
    set.delete(value);
    return;
  }

  set.add(value);
}

function getFormPayload() {
  const formData = new FormData(elements.form);

  return {
    schema_version: "1.0",
    request_id: state.requestId,
    project_name: formData.get("projectName") || "",
    task_type: formData.get("taskType"),
    task_label: taskLabels[formData.get("taskType")] || "自定义任务",
    search_mode: formData.get("searchMode"),
    target_precision: formData.get("targetPrecision"),
    task_description: formData.get("taskDescription") || "",
    dataset_hint: formData.get("datasetHint") || "",
    dataset_url: formData.get("datasetUrl") || "",
    candidate_base_models: Array.from(state.selectedModels),
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
  elements.reviewSummary.replaceChildren();
  appendReviewItem(elements.reviewSummary, "任务", `${payload.project_name} · ${payload.task_label}`);
  appendReviewItem(elements.reviewSummary, "搜索方式", getSelectedOptionText("searchMode"));
  appendReviewItem(elements.reviewSummary, "候选模型", payload.candidate_base_models.join("、"));
  appendReviewItem(elements.reviewSummary, "量化来源", payload.quantized_layer_sources.join("、"));
  appendReviewItem(
    elements.reviewSummary,
    "资源约束",
    `${getSelectedOptionText("hardware")} · ${payload.constraints.memory_cap_gb} GB · ${getSelectedOptionText("targetPrecision")}`
  );
  appendReviewItem(elements.reviewSummary, "交付", getSelectedOptionText("deliverable"));
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
    throw new Error("需求接收渠道尚未配置，请稍后再试或通过页面底部联系邮箱提交。 ");
  }

  setProgress(22, "正在加密传输需求");

  const isAppsScript = endpoint.includes("script.google.com");
  const response = await fetch(endpoint, {
    method: "POST",
    mode: isAppsScript ? "no-cors" : "cors",
    headers: {
      "Content-Type": isAppsScript ? "text/plain;charset=utf-8" : "application/json"
    },
    body: JSON.stringify({
      ...payload,
      website: document.querySelector("#website").value
    })
  });

  if (!isAppsScript && !response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request API returned ${response.status}`);
  }

  const serverReceipt = isAppsScript ? null : await response.json();
  setProgress(100, "需求已发送，请检查确认邮件");

  return {
    schema_version: "1.0",
    request_id: serverReceipt?.request_id || payload.request_id,
    status: serverReceipt?.status || "submitted",
    submitted_at: serverReceipt?.submitted_at || new Date().toISOString(),
    contact_email: payload.contact_email,
    deliverable: payload.deliverable,
    message: "请求已发送。确认邮件到达后即表示 Google Sheet 已成功记录本次需求。",
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

function renderReceipt(receipt) {
  state.lastResult = receipt;
  elements.resultSection.hidden = false;
  elements.resultJson.textContent = JSON.stringify(receipt, null, 2);
  elements.resultCopy.textContent = `请求 ${receipt.request_id} 已发送。确认邮件到达后即表示需求已写入处理队列；结果完成后会发送到 ${receipt.contact_email}。`;
  elements.resultMetrics.replaceChildren();
  appendMetric("Request ID", receipt.request_id);
  appendMetric("Status", receipt.status.toUpperCase());
  appendMetric("Delivery", "JSON via email");
  appendMetric("Email", receipt.contact_email);
  elements.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
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

  elements.copyButton.textContent = "已复制";
  window.setTimeout(() => {
    elements.copyButton.textContent = "复制请求 JSON";
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
  renderChipGroup(elements.modelChips, baseModels, state.selectedModels, (model) => {
    toggleSelected(state.selectedModels, model);
  });
  renderChipGroup(elements.quantizerChips, quantizers, state.selectedQuantizers, (quantizer) => {
    toggleSelected(state.selectedQuantizers, quantizer);
  });

  elements.form.addEventListener("input", updatePreview);
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
      setProgress(0, "提交未通过校验");
      return;
    }

    submitButton.disabled = true;
    submitLabel.textContent = "提交中...";
    setProgress(8, "正在校验需求字段");

    try {
      const receipt = await submitRequest(payload);
      renderReceipt(receipt);
    } catch (error) {
      setProgress(0, `提交失败：${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = "提交搜索需求";
    }
  });

  elements.copyButton.addEventListener("click", copyResult);
  elements.downloadButton.addEventListener("click", downloadResult);
  showFormStep(1);
  updatePreview();
}

setupRevealAnimation();
setupHeroLossAnimation();
setupForm();
