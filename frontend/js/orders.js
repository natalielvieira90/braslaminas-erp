const conteudo = document.getElementById("pedidos-conteudo");
const mensagem = document.getElementById("mensagem");

const STATUS_LABEL = {
  pending: "Pendente",
  paid: "Pago",
  preparing: "Preparando",
  shipped: "Enviado",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const PAYMENT_METHOD = {
  pix: "PIX",
  credit_card: "Cartão",
  boleto: "Boleto",
};

const PAYMENT_STATUS_LABEL = {
  pending: "Aguardando",
  approved: "Aprovado",
  rejected: "Recusado",
  refunded: "Estornado",
  cancelled: "Cancelado",
};

const TIMELINE_LABEL = {
  order_received: "Pedido recebido",
  payment_approved: "Pagamento aprovado",
  order_prepared: "Pedido preparado",
  posted: "Objeto postado",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
};

function formatDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("pt-BR");
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

function payChip(status) {
  return `<span class="status-chip status-${status}">${PAYMENT_STATUS_LABEL[status] || status}</span>`;
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
            <th>Pagamento</th>
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
              <td>${PAYMENT_METHOD[o.payment_method] || "-"} · ${payChip(o.payment_status)}</td>
              <td>${statusChip(o.status)}</td>
              <td>${money(o.total)}</td>
              <td><button class="link" data-order="${o.id}">Ver detalhes</button></td>
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

function paymentBlockHtml(payment) {
  if (!payment) return "<p class='admin-muted'>Sem pagamento registrado.</p>";
  const d = payment.details || {};
  let info = "";

  if (payment.method === "pix" && d.pix_code) {
    info = `
      <div class="code-box">
        <small>PIX Copia e Cola</small>
        <code id="pay-code">${d.pix_code}</code>
      </div>
      <button class="btn" id="btn-copiar">Copiar código PIX</button>
    `;
  } else if (payment.method === "boleto" && d.barcode) {
    info = `
      <div class="code-box">
        <small>Linha digitável do boleto (vence ${formatShortDate(d.due_date)})</small>
        <code id="pay-code">${d.barcode}</code>
      </div>
      <button class="btn" id="btn-copiar">Copiar linha digitável</button>
    `;
  } else if (payment.method === "credit_card") {
    info = `<p class="admin-info">Cartão •••• ${d.card_last4 || ""} · Autorização ${payment.transaction_code || "-"}</p>`;
  }

  return `
    <p class="admin-info"><b>Método:</b> ${PAYMENT_METHOD[payment.method] || payment.method}</p>
    <p class="admin-info"><b>Situação do pagamento:</b> ${payChip(payment.status)}</p>
    ${info}
  `;
}

function timelineHtml(tracking, status) {
  const events = Array.isArray(tracking) && tracking.length ? tracking : null;

  if (events) {
    const items = events
      .map(
        (e) => `
          <li class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
              <strong>${TIMELINE_LABEL[e.status] || e.status}</strong>
              <small>${formatDate(e.event_date)}</small>
              ${e.description ? `<p class="admin-muted">${escapeHtml(e.description)}</p>` : ""}
            </div>
          </li>
        `
      )
      .join("");
    return `<ul class="timeline">${items}</ul>`;
  }

  const current = STATUS_LABEL[status] || status;
  return `<p class="admin-muted">Ainda sem eventos de rastreamento. Status atual: ${current}.</p>`;
}

async function showOrder(orderId) {
  try {
    const { order, items, payment, tracking } = await API.get(`/orders/${orderId}`);
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
        <span>Subtotal: ${money(order.subtotal)} + Frete: ${money(order.shipping_cost)}</span>
        <strong>Total: ${money(order.total)}</strong>
      </div>
      <br>
      <div class="form-card" style="margin-bottom:24px">
        <h3>Pagamento e entrega</h3>
        ${paymentBlockHtml(payment)}
        ${order.shipping_address ? `<p class="admin-info" style="margin-top:10px"><b>Endereço de entrega:</b> ${escapeHtml(order.shipping_address)}</p>` : ""}
        ${order.tracking_code ? `<p class="admin-info" style="margin-top:10px"><b>Código de rastreio:</b> ${escapeHtml(order.tracking_code)}</p>` : ""}
      </div>
      <div class="form-card" style="margin-bottom:24px">
        <h3>Rastreamento</h3>
        ${timelineHtml(tracking, order.status)}
      </div>
      <a class="btn btn-outline" href="pedidos.html">&larr; Voltar para meus pedidos</a>
    `;

    document.getElementById("btn-copiar")?.addEventListener("click", () => {
      const text = document.getElementById("pay-code").textContent;
      navigator.clipboard.writeText(text).then(() => toast("Código copiado!", "success"));
    });
  } catch (err) {
    showMessage(mensagem, err.message);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
