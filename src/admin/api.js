const adminBase = import.meta.env.BASE_URL;
const siteBase = adminBase.replace(/admin\/?$/, "");
const apiRoot = `${siteBase}api`;

export class ApiError extends Error {
  constructor(response, payload) {
    super(payload?.error?.message || `Request failed with status ${response.status}`);
    this.name = "ApiError";
    this.status = response.status;
    this.type = payload?.error?.type || "request_failed";
    this.details = payload?.error?.details || {};
  }
}

async function apiRequest(path, { method = "GET", json, body, csrf } = {}) {
  const headers = new Headers({ Accept: "application/json" });
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  if (csrf) {
    headers.set("X-CSRF-Token", csrf);
  }

  const response = await fetch(`${apiRoot}${path}`, {
    method,
    headers,
    body,
    credentials: "same-origin",
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw new ApiError(response, payload);
  }
  return payload;
}

export function getSession() {
  return apiRequest("/session");
}

export function loginSession(username, password) {
  return apiRequest("/session/login", {
    method: "POST",
    json: { username, password },
  });
}

export function logoutSession(csrf) {
  return apiRequest("/session", { method: "DELETE", csrf });
}

export function getMenuDocument() {
  return apiRequest("/admin/menu");
}

export function saveMenuDocument(csrf, document) {
  return apiRequest("/admin/menu", {
    method: "PUT",
    csrf,
    json: document,
  });
}

export function uploadMenuMedia(csrf, file) {
  const body = new FormData();
  body.append("image", file);
  return apiRequest("/admin/media", { method: "POST", csrf, body });
}

export function getPublishStatus() {
  return apiRequest("/admin/publish-status");
}

export function retryPublish(csrf) {
  return apiRequest("/admin/publish-retry", { method: "POST", csrf });
}
