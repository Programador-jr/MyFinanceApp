// js/loadNavbar.js

document.addEventListener("DOMContentLoaded", async () => {
  const navbarContainer = document.getElementById("loadNavbar");
  if (!navbarContainer) return;

  try {
    const res = await fetch("navbar.html", { cache: "no-store" });
    if (!res.ok) throw new Error("Erro ao carregar navbar.html");

    const html = await res.text();
    navbarContainer.innerHTML = html;

    // Evento (mantido)
    document.dispatchEvent(new Event("navbarLoaded"));

    // Chamada direta (não depende do evento)
    if (typeof window.initProfileMenu === "function") {
      window.initProfileMenu();
    }

    // Marca link ativo (Bootstrap)
    const currentPage = (window.location.pathname.split("/").pop() || "").trim();

    document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
      const href = (link.getAttribute("href") || "").split("/").pop();
      const isActive =
        (currentPage === "" && href === "dashboard.html") || href === currentPage;

      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    // Depois de inserir a navbar, re-inicializa/binda o que depende dela
    if (typeof initTheme === "function") initTheme();
    if (typeof setupThemeListeners === "function") setupThemeListeners();

    if (typeof bindInviteModal === "function") bindInviteModal();
    if (typeof bindLogoutModal === "function") bindLogoutModal();
  } catch (err) {
    console.error(err);
    navbarContainer.innerHTML = `
      <div class="p-2 text-danger small">
        Navbar não carregada
      </div>
    `;
  }
});
