const API_URL = window.__API_URL__;

const TOKEN_KEY = "token";
const USER_KEY = "user";
const LOGOUT_SYNC_KEY = "logout_at";
const LAST_ACTIVITY_KEY = "last_activity_at";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function isFormDataBody(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function logout(reason = "logout") {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.setItem(LOGOUT_SYNC_KEY, Date.now().toString());
  } catch (_) {}

  if (typeof showAlert === "function" && !window.location.pathname.endsWith("index.html")) {
    const message = "Sessão expirada. Faça login novamente.";

    showAlert(message, "warning", "triangle-exclamation");

    setTimeout(() => {
      if (!window.location.pathname.endsWith("index.html")) {
        window.location.href = "index.html?reason=" + encodeURIComponent(reason);
      }
    }, 2500);

    return;
  }

  if (!window.location.pathname.endsWith("index.html")) {
    window.location.href = "index.html?reason=" + encodeURIComponent(reason);
  }
}

window.appLogout = logout;

window.addEventListener("storage", (e) => {
  if (e.key === LOGOUT_SYNC_KEY) logout("sync");
});

async function apiFetch(url, methodOrOptions = "GET", body = null) {
  const token = getToken();

  const formDataRequest =
    isFormDataBody(body) ||
    (typeof methodOrOptions === "object" && isFormDataBody(methodOrOptions.body));

  const baseHeaders = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(formDataRequest ? {} : { "Content-Type": "application/json" }),
  };

  let options = { headers: baseHeaders };

  if (typeof methodOrOptions === "object") {
    options = {
      ...methodOrOptions,
      headers: {
        ...baseHeaders,
        ...(methodOrOptions.headers || {}),
      },
    };
  } else {
    options.method = methodOrOptions;

    if (body !== null && body !== undefined) {
      options.body = formDataRequest ? body : JSON.stringify(body);
    }
  }

  const res = await fetch(API_URL + url, options);

  if (res.status === 401) {
    logout("401");
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (typeof showAlert === "function") {
      showAlert(data?.error || "Erro na requisição", "danger", "triangle-exclamation");
    }
    throw new Error(data?.error || "Erro na requisição");
  }

  return data;
}
