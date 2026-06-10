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

const modelSpecs = {
  "Qwen2.5-7B": { layers: 28, family: "qwen2.5", scale: "7b" },
  "Qwen2.5-32B": { layers: 64, family: "qwen2.5", scale: "32b" },
  "Qwen3-8B": { layers: 36, family: "qwen3", scale: "8b" },
  "Qwen3-32B": { layers: 64, family: "qwen3", scale: "32b" },
  "Llama2-7B": { layers: 32, family: "llama2", scale: "7b" },
  "Llama2-13B": { layers: 40, family: "llama2", scale: "13b" },
  "Llama2-70B": { layers: 80, family: "llama2", scale: "70b" },
  "Llama3.1-8B": { layers: 32, family: "llama3.1", scale: "8b" },
  "Llama3.1-70B": { layers: 80, family: "llama3.1", scale: "70b" }
};

const taskLabels = {
  long_context_qa: "长上下文问答",
  code_generation: "代码生成",
  math_reasoning: "数学推理",
  instruction_following: "指令遵循",
  domain_rag: "领域 RAG",
  custom: "自定义任务"
};

const searchSteps = [
  ["构建 layer bank 索引", 18],
  ["生成任务画像与约束向量", 32],
  ["采样候选 layer composition", 55],
  ["运行代理评测与硬件估计", 76],
  ["选择 Pareto 最优配置", 92],
  ["打包 HF pull manifest", 100]
];

const state = {
  selectedModels: new Set(["Qwen2.5-7B", "Llama3.1-8B"]),
  selectedQuantizers: new Set(["ParoQuant", "GPTAQ", "SlimLLM"]),
  lastResult: null
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
    project_name: formData.get("projectName") || "",
    task_type: formData.get("taskType"),
    task_label: taskLabels[formData.get("taskType")] || "自定义任务",
    task_description: formData.get("taskDescription") || "",
    dataset_hint: formData.get("datasetHint") || "",
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
    requested_at: new Date().toISOString()
  };
}

function updatePreview() {
  elements.latencyValue.textContent = elements.latencyInput.value;
  elements.qualityValue.textContent = elements.qualityInput.value;
  elements.preview.textContent = JSON.stringify(getFormPayload(), null, 2);
}

function setProgress(percent, label) {
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressLabel.textContent = label;
}

function pickBestModel(payload) {
  const selected = payload.candidate_base_models;
  const memoryCap = payload.constraints.memory_cap_gb;
  const latencyPriority = payload.constraints.latency_priority;

  if (memoryCap >= 48 && selected.includes("Llama3.1-70B")) {
    return "Llama3.1-70B";
  }

  if (memoryCap >= 48 && selected.includes("Qwen2.5-32B")) {
    return "Qwen2.5-32B";
  }

  if (latencyPriority >= 8 && selected.includes("Qwen3-8B")) {
    return "Qwen3-8B";
  }

  return selected.find((model) => model.includes("8B") || model.includes("7B")) || selected[0];
}

function buildLayerComposition(model, payload) {
  const spec = modelSpecs[model] || { layers: 32, family: "custom", scale: "unknown" };
  const chosenQuantizers = payload.quantized_layer_sources;
  const segmentCount = Math.min(chosenQuantizers.length, 4);
  const segmentSize = Math.ceil(spec.layers / segmentCount);

  return Array.from({ length: segmentCount }, (_, index) => {
    const start = index * segmentSize;
    const end = Math.min((index + 1) * segmentSize - 1, spec.layers - 1);
    const quantizer = chosenQuantizers[index % chosenQuantizers.length];
    const quantizerSlug = quantizer.toLowerCase().replace("+", "plus");
    const modelSlug = `${spec.family}-${spec.scale}`;

    return {
      layer_range: `${start}-${end}`,
      quantizer,
      hf_source: `hf://your-org/quant-layer-bank/${modelSlug}/${quantizerSlug}/layers-${start}-${end}`,
      reason: getSegmentReason(payload.task_type, index)
    };
  });
}

function getSegmentReason(taskType, index) {
  const reasons = {
    long_context_qa: ["保留 early attention 稳定性", "降低中间层显存", "强化长上下文聚合", "平衡解码延迟"],
    code_generation: ["保留 token pattern 表征", "优化 MLP 层吞吐", "提升语法一致性", "约束 decode latency"],
    math_reasoning: ["保留推理链路表征", "降低激活漂移", "强化后段 logits 稳定性", "控制误差累积"],
    instruction_following: ["稳定指令解析", "压缩中间专家路径", "保留对齐层敏感性", "优化服务延迟"],
    domain_rag: ["保留检索证据融合", "降低领域层冗余", "强化引用一致性", "控制上下文成本"],
    custom: ["按任务代理指标保留", "按显存约束压缩", "按延迟目标重排", "按质量下限校准"]
  };

  return (reasons[taskType] || reasons.custom)[index] || "按 Pareto 目标选择";
}

function buildMockResult(payload) {
  const selectedModel = pickBestModel(payload);
  const composition = buildLayerComposition(selectedModel, payload);
  const memoryRatio = Math.min(0.92, 0.38 + payload.constraints.memory_cap_gb / 120);
  const latencyIndex = Math.min(9.7, 5.2 + payload.constraints.latency_priority * 0.42);
  const qualityRetention = Math.min(99, payload.constraints.quality_floor_percent + 0.8);

  return {
    config_version: "0.1.0-demo",
    job_id: `qnas-${Date.now().toString(36)}`,
    status: "demo_completed",
    project_name: payload.project_name,
    target_task: {
      type: payload.task_type,
      label: payload.task_label,
      description: payload.task_description,
      dataset_hint: payload.dataset_hint
    },
    selected_base_model: selectedModel,
    objective: {
      hardware: payload.constraints.hardware,
      memory_cap_gb: payload.constraints.memory_cap_gb,
      latency_priority: payload.constraints.latency_priority,
      quality_floor_percent: payload.constraints.quality_floor_percent
    },
    estimated_metrics: {
      memory_footprint_gb: Number((payload.constraints.memory_cap_gb * memoryRatio).toFixed(1)),
      latency_index: Number(latencyIndex.toFixed(1)),
      quality_retention_percent: Number(qualityRetention.toFixed(1))
    },
    layer_composition: composition,
    hf_pull_manifest: {
      namespace: "your-org/quant-layer-bank",
      pull_strategy: "download selected linear-layer shards only",
      shards: composition.map((segment) => segment.hf_source)
    },
    reproducibility: {
      search_seed: 20260419,
      evaluator: "replace-with-your-server-side-evaluator",
      notes: "This local result is a front-end mock. Replace it with the real NAS service response."
    }
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function runLocalDemoSearch(payload) {
  for (const [label, percent] of searchSteps) {
    setProgress(percent, label);
    await wait(420);
  }

  return buildMockResult(payload);
}

async function submitToNasService(endpoint, payload) {
  setProgress(12, "正在提交到远端 NAS 服务");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`NAS API returned ${response.status}`);
  }

  setProgress(100, "远端 NAS 服务已返回结果");
  return response.json();
}

function renderResult(result) {
  state.lastResult = result;
  elements.resultSection.hidden = false;
  elements.resultJson.textContent = JSON.stringify(result, null, 2);

  const status = result.status === "demo_completed" ? "本地演示模式已生成可替换的配置结构。" : "远端 NAS 服务已返回配置。";
  elements.resultCopy.textContent = `${status} 你可以复制或下载 JSON，然后交给后端/推理侧按 HF manifest 拉取对应线性层。`;

  const metrics = result.estimated_metrics || {};
  elements.resultMetrics.innerHTML = `
    <span><strong>${result.selected_base_model || "Server selected"}</strong>Base Model</span>
    <span><strong>${metrics.memory_footprint_gb ?? "--"} GB</strong>Memory</span>
    <span><strong>${metrics.latency_index ?? "--"}/10</strong>Latency Index</span>
    <span><strong>${metrics.quality_retention_percent ?? "--"}%</strong>Quality Retention</span>
  `;

  elements.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyResult() {
  if (!state.lastResult) {
    return;
  }

  const content = JSON.stringify(state.lastResult, null, 2);

  try {
    await navigator.clipboard.writeText(content);
    elements.copyButton.textContent = "已复制";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    elements.copyButton.textContent = "已复制";
  }

  window.setTimeout(() => {
    elements.copyButton.textContent = "复制配置 JSON";
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
  link.download = `${state.lastResult.job_id || "quantnas-config"}.json`;
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
  elements.latencyInput.addEventListener("change", updatePreview);
  elements.qualityInput.addEventListener("change", updatePreview);

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = elements.form.querySelector(".submit-button");
    const endpoint = document.querySelector("#apiEndpoint").value.trim();
    const payload = getFormPayload();

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "搜索中...";
    setProgress(6, endpoint ? "准备提交远端任务" : "启动本地演示搜索");

    try {
      const result = endpoint ? await submitToNasService(endpoint, payload) : await runLocalDemoSearch(payload);
      renderResult(result);
    } catch (error) {
      setProgress(0, `提交失败：${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "启动 NAS 搜索";
    }
  });

  elements.copyButton.addEventListener("click", copyResult);
  elements.downloadButton.addEventListener("click", downloadResult);
  updatePreview();
}

setupRevealAnimation();
setupHeroLossAnimation();
setupForm();
