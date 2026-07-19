var REQUESTS_SHEET = "Requests";
var CONFIG_SHEET = "Config";

var REQUEST_HEADERS = [
  "request_id",
  "created_at",
  "status",
  "contact_email",
  "project_name",
  "task_type",
  "task_label",
  "search_mode",
  "target_precision",
  "candidate_models",
  "quantizers",
  "hardware",
  "memory_cap_gb",
  "latency_priority",
  "quality_floor_percent",
  "deliverable",
  "expected_turnaround",
  "dataset_hint",
  "dataset_url",
  "task_description",
  "request_json",
  "result_json",
  "result_file_name",
  "confirmation_sent_at",
  "result_sent_at",
  "last_error"
];

var DEFAULT_CONFIG = {
  SENDER_NAME: "QuantNAS Studio",
  ADMIN_EMAILS: "Jiaqizhao0455@outlook.com,3231487539@qq.com",
  REPLY_TO: "",
  SITE_URL: "https://hittopu.github.io/quantnas-studio/"
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("QuantNAS")
    .addItem("初始化工作表", "setupQuantNasChannel")
    .addSeparator()
    .addItem("发送当前行结果", "sendResultForActiveRow")
    .addItem("发送全部 READY 结果", "sendReadyResults")
    .addToUi();
}

function setupQuantNasChannel() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  var requests = spreadsheet.getSheetByName(REQUESTS_SHEET) || spreadsheet.insertSheet(REQUESTS_SHEET);
  var config = spreadsheet.getSheetByName(CONFIG_SHEET) || spreadsheet.insertSheet(CONFIG_SHEET);

  if (requests.getLastRow() === 0) {
    requests.getRange(1, 1, 1, REQUEST_HEADERS.length).setValues([REQUEST_HEADERS]);
  } else {
    var existingHeaders = requests.getRange(1, 1, 1, REQUEST_HEADERS.length).getDisplayValues()[0];
    if (existingHeaders.join("|") !== REQUEST_HEADERS.join("|")) {
      throw new Error("Requests sheet headers do not match this version. Back up the sheet before migrating.");
    }
  }
  requests.setFrozenRows(1);
  requests.getRange(1, 1, 1, REQUEST_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0b2a26")
    .setFontColor("#fffaf0");
  requests.setColumnWidth(1, 190);
  requests.setColumnWidth(4, 220);
  requests.setColumnWidth(5, 220);
  requests.setColumnWidth(20, 360);
  requests.setColumnWidth(21, 360);
  requests.setColumnWidth(22, 360);

  if (config.getLastRow() === 0) {
    config.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
    config.getRange(2, 1, Object.keys(DEFAULT_CONFIG).length, 2).setValues(
      Object.keys(DEFAULT_CONFIG).map(function (key) {
        return [key, DEFAULT_CONFIG[key]];
      })
    );
  }
  config.setFrozenRows(1);
  config.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#0b2a26").setFontColor("#fffaf0");
  config.autoResizeColumns(1, 2);

  SpreadsheetApp.getUi().alert("QuantNAS 渠道已初始化。请检查 Config 表，然后部署为 Web App。");
}

function doGet() {
  return jsonOutput_({
    ok: true,
    service: "QuantNAS Studio request channel",
    version: "1.0.0"
  });
}

function doPost(event) {
  var payload;

  try {
    payload = parsePayload_(event);
    validatePayload_(payload);

    if (payload.website) {
      return jsonOutput_({ ok: true, status: "ignored" });
    }

    var sheet = getRequestsSheet_();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      if (findRequestRow_(sheet, payload.request_id)) {
        return jsonOutput_({
          ok: true,
          request_id: payload.request_id,
          status: "already_submitted"
        });
      }

      sheet.appendRow(buildRequestRow_(payload));
    } finally {
      lock.releaseLock();
    }

    var row = findRequestRow_(sheet, payload.request_id);
    try {
      sendConfirmationEmail_(payload);
      setCellByHeader_(sheet, row, "confirmation_sent_at", new Date());
      notifyAdmins_(payload);
    } catch (mailError) {
      setCellByHeader_(sheet, row, "status", "SUBMITTED_EMAIL_FAILED");
      setCellByHeader_(sheet, row, "last_error", mailError.message);
    }

    return jsonOutput_({
      ok: true,
      request_id: payload.request_id,
      status: "submitted",
      submitted_at: new Date().toISOString()
    });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}

function sendResultForActiveRow() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange().getRow();

  if (sheet.getName() !== REQUESTS_SHEET || row < 2) {
    SpreadsheetApp.getUi().alert("请在 Requests 表中选中需要发送的请求行。");
    return;
  }

  var record = readRow_(sheet, row);
  var choice = SpreadsheetApp.getUi().alert(
    "发送 QuantNAS 结果",
    "将 JSON 附件发送到 " + record.contact_email + "？",
    SpreadsheetApp.getUi().ButtonSet.YES_NO
  );

  if (choice !== SpreadsheetApp.getUi().Button.YES) {
    return;
  }

  sendResultForRow_(sheet, row);
  SpreadsheetApp.getUi().alert("结果已发送，状态已更新为 SENT。");
}

function sendReadyResults() {
  var sheet = getRequestsSheet_();
  var lastRow = sheet.getLastRow();
  var sent = 0;
  var failed = 0;

  for (var row = 2; row <= lastRow; row += 1) {
    var record = readRow_(sheet, row);
    if (String(record.status).toUpperCase() !== "READY") {
      continue;
    }

    try {
      sendResultForRow_(sheet, row);
      sent += 1;
    } catch (error) {
      failed += 1;
    }
  }

  SpreadsheetApp.getUi().alert("发送完成：成功 " + sent + "，失败 " + failed + "。");
}

function sendResultForRow_(sheet, row) {
  var record = readRow_(sheet, row);

  try {
    if (!record.contact_email) {
      throw new Error("该行缺少 contact_email。");
    }

    if (!record.result_json) {
      throw new Error("该行缺少 result_json。");
    }

    var result = JSON.parse(record.result_json);
    var prettyJson = JSON.stringify(result, null, 2);
    var fileName = record.result_file_name || record.request_id + "-result.json";
    var config = getConfig_();
    var subject = "[QuantNAS Studio] Result ready - " + record.request_id;
    var plainBody = [
      "Your QuantNAS result is ready.",
      "",
      "Request ID: " + record.request_id,
      "Project: " + record.project_name,
      "Task: " + record.task_label,
      "",
      "The result JSON is attached to this email.",
      "Please keep the request ID when contacting the research team."
    ].join("\n");

    var options = {
      name: config.SENDER_NAME || DEFAULT_CONFIG.SENDER_NAME,
      htmlBody: buildResultHtml_(record),
      attachments: [Utilities.newBlob(prettyJson, "application/json", fileName)]
    };
    if (config.REPLY_TO) {
      options.replyTo = config.REPLY_TO;
    }

    MailApp.sendEmail(record.contact_email, subject, plainBody, options);
    setCellByHeader_(sheet, row, "status", "SENT");
    setCellByHeader_(sheet, row, "result_sent_at", new Date());
    setCellByHeader_(sheet, row, "last_error", "");
  } catch (error) {
    setCellByHeader_(sheet, row, "status", "SEND_FAILED");
    setCellByHeader_(sheet, row, "last_error", error.message);
    throw error;
  }
}

function parsePayload_(event) {
  var body = event && event.postData && event.postData.contents;
  if (body) {
    return JSON.parse(body);
  }

  return event && event.parameter ? event.parameter : {};
}

function validatePayload_(payload) {
  if (!payload.request_id || !/^QNAS-[A-Z0-9-]+$/i.test(payload.request_id)) {
    throw new Error("Invalid request_id.");
  }
  if (!payload.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email)) {
    throw new Error("Invalid contact_email.");
  }
  if (!payload.project_name) {
    throw new Error("project_name is required.");
  }
  if (payload.privacy_consent !== true) {
    throw new Error("privacy_consent is required.");
  }
}

function buildRequestRow_(payload) {
  var constraints = payload.constraints || {};
  var values = {
    request_id: payload.request_id,
    created_at: new Date(),
    status: "SUBMITTED",
    contact_email: payload.contact_email,
    project_name: payload.project_name,
    task_type: payload.task_type,
    task_label: payload.task_label,
    search_mode: payload.search_mode,
    target_precision: payload.target_precision,
    candidate_models: (payload.candidate_base_models || []).join(", "),
    quantizers: (payload.quantized_layer_sources || []).join(", "),
    hardware: constraints.hardware || "",
    memory_cap_gb: constraints.memory_cap_gb || "",
    latency_priority: constraints.latency_priority || "",
    quality_floor_percent: constraints.quality_floor_percent || "",
    deliverable: payload.deliverable || "config_json",
    expected_turnaround: payload.expected_turnaround || "standard",
    dataset_hint: payload.dataset_hint || "",
    dataset_url: payload.dataset_url || "",
    task_description: payload.task_description || "",
    request_json: JSON.stringify(payload, null, 2),
    result_json: "",
    result_file_name: payload.request_id + "-result.json",
    confirmation_sent_at: "",
    result_sent_at: "",
    last_error: ""
  };

  return REQUEST_HEADERS.map(function (header) {
    return values[header];
  });
}

function sendConfirmationEmail_(payload) {
  var config = getConfig_();
  var subject = "[QuantNAS Studio] Request received - " + payload.request_id;
  var plainBody = [
    "We received your QuantNAS request.",
    "",
    "Request ID: " + payload.request_id,
    "Project: " + payload.project_name,
    "Task: " + payload.task_label,
    "Search mode: " + payload.search_mode,
    "Target precision: " + payload.target_precision,
    "",
    "We will email the result JSON after the search and formal evaluation are complete."
  ].join("\n");

  var options = {
    name: config.SENDER_NAME || DEFAULT_CONFIG.SENDER_NAME,
    htmlBody: buildConfirmationHtml_(payload)
  };
  if (config.REPLY_TO) {
    options.replyTo = config.REPLY_TO;
  }

  MailApp.sendEmail(payload.contact_email, subject, plainBody, options);
}

function notifyAdmins_(payload) {
  var config = getConfig_();
  var recipients = String(config.ADMIN_EMAILS || "")
    .split(",")
    .map(function (email) { return email.trim(); })
    .filter(String);

  if (!recipients.length) {
    return;
  }

  var spreadsheetUrl = getSpreadsheet_().getUrl();
  MailApp.sendEmail({
    to: recipients.join(","),
    subject: "[QuantNAS Studio] New request - " + payload.request_id,
    name: config.SENDER_NAME || DEFAULT_CONFIG.SENDER_NAME,
    body: "A new QuantNAS request was submitted.\n\nRequest ID: " + payload.request_id + "\nProject: " + payload.project_name + "\nSheet: " + spreadsheetUrl
  });
}

function buildConfirmationHtml_(payload) {
  return '<div style="font-family:Arial,sans-serif;color:#0b2a26;line-height:1.65">' +
    '<h2 style="margin:0 0 16px">QuantNAS request received</h2>' +
    '<p>Your request has entered the review queue.</p>' +
    '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
    rowHtml_("Request ID", payload.request_id) +
    rowHtml_("Project", payload.project_name) +
    rowHtml_("Task", payload.task_label) +
    rowHtml_("Search mode", payload.search_mode) +
    rowHtml_("Target precision", payload.target_precision) +
    '</table>' +
    '<p>We will send the result JSON to this email after NAS search and formal evaluation.</p>' +
    '</div>';
}

function buildResultHtml_(record) {
  return '<div style="font-family:Arial,sans-serif;color:#0b2a26;line-height:1.65">' +
    '<h2 style="margin:0 0 16px">Your QuantNAS result is ready</h2>' +
    '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
    rowHtml_("Request ID", record.request_id) +
    rowHtml_("Project", record.project_name) +
    rowHtml_("Task", record.task_label) +
    '</table>' +
    '<p>The result JSON is attached. Please keep the request ID for follow-up questions.</p>' +
    '</div>';
}

function rowHtml_(label, value) {
  return '<tr><td style="color:#64706e">' + escapeHtml_(label) + '</td><td><strong>' + escapeHtml_(value || "-") + '</strong></td></tr>';
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getRequestsSheet_() {
  var sheet = getSpreadsheet_().getSheetByName(REQUESTS_SHEET);
  if (!sheet) {
    throw new Error("Requests sheet is missing. Run setupQuantNasChannel first.");
  }
  return sheet;
}

function getConfig_() {
  var sheet = getSpreadsheet_().getSheetByName(CONFIG_SHEET);
  var config = {};
  Object.keys(DEFAULT_CONFIG).forEach(function (key) {
    config[key] = DEFAULT_CONFIG[key];
  });

  if (!sheet || sheet.getLastRow() < 2) {
    return config;
  }

  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (row) {
    if (row[0]) {
      config[String(row[0]).trim()] = String(row[1] || "").trim();
    }
  });
  return config;
}

function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("Spreadsheet is not configured. Run setupQuantNasChannel from the bound Sheet first.");
  }

  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", active.getId());
  return active;
}

function findRequestRow_(sheet, requestId) {
  if (sheet.getLastRow() < 2) {
    return 0;
  }

  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var index = 0; index < ids.length; index += 1) {
    if (ids[index][0] === requestId) {
      return index + 2;
    }
  }
  return 0;
}

function readRow_(sheet, row) {
  var values = sheet.getRange(row, 1, 1, REQUEST_HEADERS.length).getDisplayValues()[0];
  var record = {};
  REQUEST_HEADERS.forEach(function (header, index) {
    record[header] = values[index];
  });
  return record;
}

function setCellByHeader_(sheet, row, header, value) {
  var column = REQUEST_HEADERS.indexOf(header) + 1;
  if (!row || !column) {
    throw new Error("Unable to update " + header + ".");
  }
  sheet.getRange(row, column).setValue(value);
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
