function renderNavAuth() {
  const navAuth = document.getElementById("nav-auth");
  if (!navAuth) return;

  const label = navAuth.querySelector(".hdr-label");

  if (API.isAuthenticated()) {
    const user = API.getUser();
    const name = user ? user.name.split(" ")[0] : "Cliente";
    if (label) {
      label.textContent = `OLÁ, ${name.toUpperCase()}`;
    } else {
      navAuth.textContent = `Sair (${name})`;
    }
    navAuth.onclick = (e) => {
      e.preventDefault();
      API.logout();
      window.location.reload();
    };
  } else {
    if (label) {
      label.textContent = "MEU PERFIL";
    } else {
      navAuth.textContent = "Login";
    }
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
  const cartLink = document.getElementById("nav-cart");
  if (!badge) return;

  if (!API.isAuthenticated()) {
    badge.classList.remove("visible");
    if (cartLink) cartLink.style.display = "none";
    return;
  }

  if (cartLink) cartLink.style.display = "inline-flex";

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

const IS_IN_PAGES = window.location.pathname.includes("/pages/");

function rel(file) {
  return IS_IN_PAGES ? file : `pages/${file}`;
}

function initSiteSearch() {
  document.querySelectorAll("form.search-box").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input[type='search']");
      const term = (input && input.value.trim()) || "";
      window.location.href = term
        ? `${rel("produtos.html")}?busca=${encodeURIComponent(term)}`
        : rel("produtos.html");
    });
  });
}

async function loadNavCategories() {
  const dropdown = document.getElementById("nav-dropdown-list");
  const menu = document.querySelector(".nav-links");
  const adminLink = document.getElementById("nav-admin");

  try {
    const { categories } = await API.get("/categories");

    if (menu) {
      categories.forEach((c) => {
        const a = document.createElement("a");
        a.href = `${rel("produtos.html")}?categoria=${encodeURIComponent(c.name)}`;
        a.textContent = c.name;
        menu.insertBefore(a, adminLink || null);
      });
    }

    if (dropdown) {
      dropdown.textContent = "";
      const append = (href, text) => {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = text;
        dropdown.appendChild(a);
      };
      append(rel("produtos.html"), "Todos os produtos");
      categories.forEach((c) => {
        append(`${rel("produtos.html")}?categoria=${encodeURIComponent(c.name)}`, c.name);
      });
    }
  } catch {
    if (dropdown && !dropdown.children.length) {
      const a = document.createElement("a");
      a.href = rel("produtos.html");
      a.textContent = "Ver todos os produtos";
      dropdown.appendChild(a);
    }
  }
}

function initMenuDropdown() {
  const toggle = document.getElementById("nav-menu-toggle");
  const nav = document.querySelector(".main-nav");
  const dropdown = document.getElementById("nav-dropdown");
  if (!toggle || !nav || !dropdown) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    dropdown.hidden = !open;
  });

  loadNavCategories();

  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) {
      nav.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      dropdown.hidden = true;
    }
  });
}

function initCartWidget() {
  const widget = document.getElementById("cart-widget");
  const toggle = document.getElementById("cart-widget-toggle");
  const panel = document.getElementById("cart-widget-panel");
  const text = document.getElementById("cart-widget-text");
  if (!widget || !toggle || !panel || !text) return;

  const render = async () => {
    if (!API.isAuthenticated()) {
      text.textContent = "0 ITEM(S) NO CARRINHO";
      panel.innerHTML = `<p>Entre para ver o seu carrinho.</p>
        <a class="btn" href="${rel("login.html")}">ENTRAR</a>`;
      return;
    }

    try {
      const { items } = await API.get("/cart");
      const count = items.reduce((s, i) => s + i.quantity, 0);
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      text.textContent = `${count} ITEM(S) NO CARRINHO`;

      if (count > 0) {
        panel.innerHTML = `
          <ul class="cart-widget-list">
            ${items
              .map(
                (i) => `
              <li>
                <span class="cart-widget-item-name">${i.name} × ${i.quantity}</span>
                <b>${money(i.price * i.quantity)}</b>
              </li>
            `
              )
              .join("")}
          </ul>
          <p class="cart-widget-total">Total: <b>${money(total)}</b></p>
          <a class="btn" href="${rel("carrinho.html")}">VER CARRINHO</a>
        `;
      } else {
        panel.innerHTML = `<p>Seu carrinho está vazio.</p>
          <a class="btn" href="${rel("produtos.html")}">VER PRODUTOS</a>`;
      }
    } catch {
      text.textContent = "0 ITEM(S) NO CARRINHO";
    }
  };

  toggle.addEventListener("click", () => {
    const open = widget.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) render();
  });

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavAuth();
  updateCartBadge();
  initMobileMenu();
  initBackToTop();
  initReveal();
  initSiteSearch();
  initMenuDropdown();
  initCartWidget();
});
