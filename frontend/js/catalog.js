function isNew(product) {
  const created = new Date(product.created_at);
  const diff = Date.now() - created.getTime();
  return diff < 30 * 24 * 60 * 60 * 1000;
}

function productCard(product) {
  const image = product.image_url || "/images/produtos/placeholder.svg";
  const unavailable = product.stock <= 0;
  const detailPath = window.location.pathname.includes("/pages/")
    ? `produto.html?slug=${product.slug}`
    : `pages/produto.html?slug=${product.slug}`;

  const badge = unavailable
    ? '<span class="badge badge-esgotado">Esgotado</span>'
    : isNew(product)
    ? '<span class="badge badge-novo">Novo</span>'
    : "";

  return `
    <div class="card">
      <div class="img-wrap">
        <a href="${detailPath}">
          ${badge}
          <img src="${image}" alt="${product.name}"
               onerror="this.src='/images/produtos/placeholder.svg'">
        </a>
      </div>
      <a href="${detailPath}">
        <h3>${product.name}</h3>
        <p class="desc">${product.description || ""}</p>
      </a>
      <p class="preco">${money(product.price)}</p>
      <button class="btn" data-add-to-cart="${product.id}"
              ${unavailable ? "disabled" : ""}>
        ${unavailable ? "Esgotado" : "Adicionar ao carrinho"}
      </button>
    </div>
  `;
}

async function addToCart(productId, button) {
  if (!API.isAuthenticated()) {
    const loginPath = window.location.pathname.includes("/pages/")
      ? "login.html"
      : "pages/login.html";
    toast("Você precisa entrar para adicionar ao carrinho", "error", 3200);
    setTimeout(() => {
      window.location.href = loginPath;
    }, 1200);
    return;
  }

  const quantity = Number(button.dataset.quantity) || 1;
  button.disabled = true;
  button.textContent = "Adicionando...";

  try {
    await API.post("/cart", { product_id: productId, quantity });
    button.textContent = "Adicionado!";
    button.classList.add("btn-added");
    updateCartBadge();
    toast(quantity > 1 ? `${quantity} itens no carrinho` : "Produto adicionado ao carrinho", "success");
  } catch (err) {
    button.textContent = "Tente novamente";
    button.disabled = false;
    toast(err.message, "error");
  }
}

function initAddToCart() {
  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-add-to-cart]");
    if (button) {
      addToCart(button.dataset.addToCart, button);
    }
  });
}
