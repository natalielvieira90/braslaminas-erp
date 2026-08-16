const conteudo = document.getElementById("pedidos-conteudo");
const mensagem = document.getElementById("mensagem");

const STATUS_LABEL = {
  pending: "Pendente",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function formatDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
}

function requireLogin() {
  if (!API.isAuthenticated()) {
    conteudo.innerHTML = `
      <div class="cart-empty">
        <h2>Você precisa entrar para ver seus pedidos</h2>
        <br>
        <a class="btn" href="login.html">Entrar / Criar conta</a>
      </div>
    `;
    return false;
  }
  return true;
}

function statusChip(status) {
  return `<span class="status-chip status-${status}">${STATUS_LABEL[status] || status}</span>`;
}

function renderOrders(orders) {
  if (!orders.length) {
    conteudo.innerHTML = `
      <div class="cart-empty">
        <h2>Nenhum pedido ainda</h2>
        <p>Explore o catálogo e faça sua primeira compra.</p>
        <br>
        <a class="btn" href="produtos.html">Ver produtos</a>
      </div>
    `;
    return;
  }

  conteudo.innerHTML = `
    <div class="table-scroll">
      <table class="cart-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Data</th>
            <th>Status</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o) => `
            <tr>
              <td><strong>#${o.id.slice(0, 8)}</strong></td>
              <td>${formatDate(o.created_at)}</td>
              <td>${statusChip(o.status)}</td>
              <td>${money(o.total)}</td>
              <td><button class="link" data-order="${o.id}">Ver itens</button></td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-order]").forEach((btn) =>
    btn.addEventListener("click", () => showOrder(btn.dataset.order))
  );
}

async function showOrder(orderId) {
  try {
    const { order, items } = await API.get(`/orders/${orderId}`);
    const rows = items
      .map(
        (i) => `
      <tr>
        <td>${i.name}</td>
        <td>${money(i.price)}</td>
        <td>${i.quantity}</td>
        <td>${money(i.price * i.quantity)}</td>
      </tr>
    `
      )
      .join("");

    conteudo.innerHTML = `
      <h2 style="margin-bottom:12px">Pedido #${order.id.slice(0, 8)} — ${statusChip(order.status)}</h2>
      <div class="table-scroll">
        <table class="cart-table" style="margin-bottom:24px">
          <thead>
            <tr><th>Produto</th><th>Preço</th><th>Qtd</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="cart-total">
        <span>Total:</span>
        <strong>${money(order.total)}</strong>
      </div>
      <br>
      <a class="btn btn-outline" href="pedidos.html">&larr; Voltar para meus pedidos</a>
    `;
  } catch (err) {
    showMessage(mensagem, err.message);
  }
}

async function loadOrders() {
  if (!requireLogin()) return;

  try {
    const { orders } = await API.get("/orders");
    renderOrders(orders);
  } catch (err) {
    conteudo.innerHTML = `<p>${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadOrders);
