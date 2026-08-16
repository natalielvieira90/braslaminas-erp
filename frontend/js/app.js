function renderNavAuth() {
  const navAuth = document.getElementById("nav-auth");
  if (!navAuth) return;

  if (API.isAuthenticated()) {
    const user = API.getUser();
    const name = user ? user.name.split(" ")[0] : "Cliente";
    navAuth.textContent = `Sair (${name})`;
    navAuth.onclick = (e) => {
      e.preventDefault();
      API.logout();
      window.location.reload();
    };
  } else {
    navAuth.textContent = "Login";
    navAuth.onclick = null;
  }

  const navAdmin = document.getElementById("nav-admin");
  if (navAdmin) {
    const user = API.getUser();
    navAdmin.style.display = user && user.role === "admin" ? "inline" : "none";
  }
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function showMessage(el, text, type = "error") {
  if (!el) return;
  el.textContent = text;
  el.className = `msg msg-${type}`;
}

let toastTimer = null;

function toast(message, type = "info", duration = 2600) {
  let container = document.getElementById("toast");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast";
    document.body.appendChild(container);
  }

  const item = document.createElement("div");
  item.className = `toast-item toast-${type}`;
  item.textContent = message;
  container.appendChild(item);

  container.classList.add("show");

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transition = "opacity 0.3s ease";
    setTimeout(() => item.remove(), 300);
    if (!container.children.length) {
      container.classList.remove("show");
    }
  }, duration);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (container && !container.children.length) {
      container.classList.remove("show");
    }
  }, duration + 400);
}

async function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;

  if (!API.isAuthenticated()) {
    badge.classList.remove("visible");
    return;
  }

  try {
    const { items } = await API.get("/cart");
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    badge.textContent = count;
    badge.classList.toggle("visible", count > 0);
  } catch {
    badge.classList.remove("visible");
  }
}

function initMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.querySelector("nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.classList.toggle("open", open);
  });
}

function initBackToTop() {
  const btn = document.getElementById("back-top");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 420);
  }, { passive: true });

  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavAuth();
  updateCartBadge();
  initMobileMenu();
  initBackToTop();
  initReveal();
});
