// public/js/api.js

/**
 * =========================================================
 * API CLIENT (frontend)
 * - Adiciona Authorization automaticamente (Bearer token)
 * - Suporta dois formatos:
 *   1) apiFetch("/x", { method, headers, body })
 *   2) apiFetch("/x", "POST", { ...obj })
 * - Suporta upload com FormData (não seta Content-Type)
 * - Trata 401 (token expirado/inválido): faz logout e redireciona
 * =========================================================
 */

const API_URL = window.__API_URL__ || "http://localhost:3000";

function getToken() {
  return localStorage.getItem("token");
}

function isFormDataBody(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

async function apiFetch(url, methodOrOptions = "GET", body = null) {
  const token = getToken();

  // Descobre se é FormData (upload)
  const formDataRequest =
    isFormDataBody(body) ||
    (typeof methodOrOptions === "object" && isFormDataBody(methodOrOptions.body));

  // Headers base:
  // - JSON: seta Content-Type application/json
  // - FormData: NÃO seta Content-Type (browser adiciona boundary automaticamente)
  const baseHeaders = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(formDataRequest ? {} : { "Content-Type": "application/json" }),
  };

  let options = { headers: baseHeaders };

  // Formato antigo: apiFetch(url, { ...options })
  if (typeof methodOrOptions === "object") {
    options = {
      ...methodOrOptions,
      headers: {
        ...baseHeaders,
        ...(methodOrOptions.headers || {}),
      },
    };
  } else {
    // Formato novo: apiFetch(url, "POST", body)
    options.method = methodOrOptions;

    if (body !== null && body !== undefined) {
      options.body = formDataRequest ? body : JSON.stringify(body);
    }
  }

  const res = await fetch(API_URL + url, options);

  // 401: token inválido/expirado -> encerra sessão
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Evita loop se já estiver no login
    if (!window.location.pathname.endsWith("index.html")) {
      window.location.href = "index.html";
    }

    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // Alguns endpoints podem retornar 204 sem body
  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Se vier erro do back, tenta mostrar; senão, mensagem genérica
    if (typeof showAlert === "function") {
      showAlert(data?.error || "Erro na requisição", "danger", "triangle-exclamation");
    }
    throw new Error(data?.error || "Erro na requisição");
  }

  return data;
}
