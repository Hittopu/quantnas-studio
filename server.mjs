import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function buildServerMock(payload) {
  const model = payload.candidate_base_models?.[0] || "Qwen2.5-7B";
  const sources = payload.quantized_layer_sources?.length ? payload.quantized_layer_sources : ["ParoQuant"];

  return {
    config_version: "0.1.0-server-mock",
    job_id: `server-qnas-${Date.now().toString(36)}`,
    status: "server_mock_completed",
    selected_base_model: model,
    estimated_metrics: {
      memory_footprint_gb: Math.min(Number(payload.constraints?.memory_cap_gb || 16), 18.5),
      latency_index: 8.1,
      quality_retention_percent: Number(payload.constraints?.quality_floor_percent || 95)
    },
    layer_composition: sources.map((source, index) => ({
      layer_range: `${index * 8}-${index * 8 + 7}`,
      quantizer: source,
      hf_source: `hf://your-org/quant-layer-bank/${model.toLowerCase()}/${source.toLowerCase()}/layers-${index * 8}-${index * 8 + 7}`
    })),
    request_echo: payload
  };
}

async function handleApi(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Only POST is supported for /api/nas/search." });
    return;
  }

  try {
    const body = await readRequestBody(request);
    const payload = body ? JSON.parse(body) : {};
    sendJson(response, 200, buildServerMock(payload));
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

async function handleStatic(request, response) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const urlPath = decodeURIComponent(requestUrl.pathname);
  const resolvedPath = path.resolve(root, `.${urlPath === "/" ? "/index.html" : urlPath}`);
  const relativePath = path.relative(root, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(resolvedPath);

    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(resolvedPath)] || "application/octet-stream"
    });
    createReadStream(resolvedPath).pipe(response);
  } catch {
    const fallback = path.join(root, "index.html");
    const html = await readFile(fallback, "utf8");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  }
}

const server = createServer((request, response) => {
  if (request.url?.startsWith("/api/nas/search")) {
    handleApi(request, response);
    return;
  }

  handleStatic(request, response);
});

server.listen(port, () => {
  console.log(`QuantNAS Studio is running at http://localhost:${port}`);
});
