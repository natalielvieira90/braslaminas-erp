const conteudo = document.getElementById("conteudo-carrinho");
const mensagem = document.getElementById("mensagem");

function cartRows(items, total) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>
            <img src="${item.image_url || "/images/produtos/placeholder.svg"}"
                 onerror="this.src='/images/produtos/placeholder.svg'"
                 style="width:60px;height:60px;object-fit:cover;border-radius:8px">
          </td>
          <td>
            <strong>${item.name}</strong>
          </td>
          <td>${money(item.price)}</td>
          <td>
            <div class="qty-controls">
              <button data-dec="${item.product_id}">-</button>
              <span>${item.quantity}</span>
              <button data-inc="${item.product_id}">+</button>
            </div>
          </td>
          <td>${money(item.subtotal)}</td>
          <td>
            <button class="link" data-remove="${item.product_id}">Remover</button>
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="table-scroll">
      <table class="cart-table">
        <thead>
          <tr>
            <th></th>
            <th>Produto</th>
            <th>Preço</th>
            <th>Quantidade</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="cart-total">
      <span>Total:</span>
      <strong>${money(total)}</strong>
    </div>
    <div style="text-align:right;margin-top:20px">
      <button class="btn" id="btn-checkout">Finalizar pedido</button>
    </div>
  `;
}

function cartEmpty() {
  return `
    <div class="cart-empty">
      <h2>Seu carrinho está vazio</h2>
      <p>Explore o catálogo e adicione produtos.</p>
      <br>
      <a class="btn" href="produtos.html">Ver produtos</a>
    </div>
  `;
}

function requireLogin() {
  return `
    <div class="cart-empty">
      <h2>Você precisa entrar para ver o carrinho</h2>
      <br>
      <a class="btn" href="login.html">Entrar / Criar conta</a>
    </div>
  `;
}

async function loadCart() {
  if (!API.isAuthenticated()) {
    conteudo.innerHTML = requireLogin();
    return;
  }

  try {
    const { items, total } = await API.get("/cart");
    conteudo.innerHTML = items.length ? cartRows(items, total) : cartEmpty();

    document.getElementById("btn-checkout")?.addEventListener("click", checkout);
  } catch (err) {
    conteudo.innerHTML = `<p>${err.message}</p>`;
  }
}

async function updateQuantity(productId, delta) {
  const row = document.querySelector(`[data-inc="${productId}"]`)?.closest("tr");
  const span = row?.querySelector("span");
  if (!span) return;

  const current = Number(span.textContent);
  const next = current + delta;
  if (next < 1) return;

  try {
    await API.put(`/cart/${productId}`, { quantity: next });
    await loadCart();
    updateCartBadge();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function removeItem(productId) {
  try {
    await API.del(`/cart/${productId}`);
    await loadCart();
    updateCartBadge();
    toast("Item removido do carrinho", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function checkout() {
  const button = document.getElementById("btn-checkout");
  button.disabled = true;
  button.textContent = "Processando...";

  try {
    const { order } = await API.post("/orders", {});
    showMessage(mensagem, `Pedido ${order.id.slice(0, 8)} criado com sucesso!`, "success");
    toast("Pedido realizado com sucesso!", "success");
    updateCartBadge();
    setTimeout(loadCart, 1500);
  } catch (err) {
    showMessage(mensagem, err.message);
    toast(err.message, "error");
    button.disabled = false;
    button.textContent = "Finalizar pedido";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCart();

  conteudo.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const remove = e.target.closest("[data-remove]");

    if (inc) updateQuantity(inc.dataset.inc, 1);
    else if (dec) updateQuantity(dec.dataset.dec, -1);
    else if (remove) removeItem(remove.dataset.remove);
  });
});
