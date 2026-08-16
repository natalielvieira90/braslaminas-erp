const verificacao = document.getElementById("admin-verificacao");
const mensagem = document.getElementById("mensagem");

const ORDER_STATUS = {
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

const PAYMENT_STATUS = {
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

let currentSection = "dashboard";
let currentProducts = [];
let cachedCategories = [];
let appMode = "production";

async function loadAppMode() {
  try {
    const health = await API.get("/health");
    appMode = health.appMode || "production";
  } catch {
    appMode = "production";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(value) {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR");
}

function statusChip(status) {
  return `<span class="status-chip status-${status}">${ORDER_STATUS[status] || status}</span>`;
}

function payChip(status) {
  return `<span class="status-chip status-${status}">${PAYMENT_STATUS[status] || status}</span>`;
}

function requireAdminAccess() {
  if (!API.isAuthenticated()) {
    window.location.href = "login.html";
    return false;
  }
  const user = API.getUser();
  if (!user || user.role !== "admin") {
    verificacao.innerHTML = `
      <div class="cart-empty">
        <h2>Acesso negado</h2>
        <p>Esta área é restrita ao administrador.</p>
        <br>
        <a class="btn" href="../index.html">Voltar para a loja</a>
      </div>
    `;
    return false;
  }
  return true;
}

async function loadCategories() {
  try {
    const { categories } = await API.get("/admin/categories");
    cachedCategories = categories;
  } catch {
    cachedCategories = [];
  }
  return cachedCategories;
}

function renderAdmin() {
  verificacao.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-nav">
        <button data-sec="dashboard" class="active">Dashboard</button>
        <button data-sec="pedidos">Pedidos</button>
        <button data-sec="produtos">Produtos</button>
        <button data-sec="categorias">Categorias</button>
        <button data-sec="clientes">Clientes</button>
        <button data-sec="mensagens">Mensagens</button>
      </aside>
      <div class="admin-main">
        <div id="sec-dashboard"></div>
        <div id="sec-pedidos" hidden></div>
        <div id="sec-produtos" hidden></div>
        <div id="sec-categorias" hidden></div>
        <div id="sec-clientes" hidden></div>
        <div id="sec-mensagens" hidden></div>
      </div>
    </div>
  `;

  document.querySelectorAll(".admin-nav button").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.sec));
  });

  loadCategories().then(() => showSection("dashboard"));
}

function showSection(name) {
  currentSection = name;
  document.querySelectorAll(".admin-nav button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sec === name);
  });
  document.querySelectorAll(".admin-main > div").forEach((div) => {
    div.hidden = div.id !== `sec-${name}`;
  });

  const renderers = {
    dashboard: renderDashboard,
    pedidos: renderPedidos,
    produtos: renderProdutos,
    categorias: renderCategorias,
    clientes: renderClientes,
    mensagens: renderMensagens,
  };
  renderers[name]();
}

/* ============ DASHBOARD ============ */

async function renderDashboard() {
  const el = document.getElementById("sec-dashboard");
  const de = localStorage.getItem("admin_dash_de") || "";
  const ate = localStorage.getItem("admin_dash_ate") || "";
  el.innerHTML = `
    <div class="admin-section-head">
      <h2>Visão geral</h2>
      <div class="admin-filters">
        <input type="date" id="dash-de" value="${de}">
        <input type="date" id="dash-ate" value="${ate}">
        <button class="btn" id="dash-filtrar">Filtrar</button>
      </div>
    </div>
    <div class="admin-loading">Carregando métricas...</div>
  `;

  document.getElementById("dash-filtrar").addEventListener("click", async () => {
    localStorage.setItem("admin_dash_de", document.getElementById("dash-de").value);
    localStorage.setItem("admin_dash_ate", document.getElementById("dash-ate").value);
    await loadDashboard();
  });

  await loadDashboard();
}

async function loadDashboard() {
  const el = document.getElementById("sec-dashboard");
  const de = localStorage.getItem("admin_dash_de") || "";
  const ate = localStorage.getItem("admin_dash_ate") || "";
  const qs = new URLSearchParams();
  if (de) qs.set("de", de);
  if (ate) qs.set("ate", ate);

  try {
    const { metrics } = await API.get(`/admin/dashboard?${qs}`);
    const maxDay = Math.max(...metrics.revenueByDay.map((d) => d.revenue), 1);
    const barChart = metrics.revenueByDay
      .map((d) => {
        const h = Math.max((d.revenue / maxDay) * 100, d.revenue > 0 ? 4 : 2);
        return `
          <div class="bar-col" title="${formatShortDate(d.day)}: ${money(d.revenue)}">
            <div class="bar" style="height:${h}%"></div>
            <span class="bar-label">${d.day.slice(8)}</span>
          </div>
        `;
      })
      .join("");

    const statusTotal = Object.values(metrics.ordersByStatus).reduce((a, b) => a + b, 0) || 1;
    const statusBars = Object.keys(ORDER_STATUS)
      .filter((s) => metrics.ordersByStatus[s])
      .map((s) => {
        const count = metrics.ordersByStatus[s];
        return `
          <div class="status-row">
            <span>${statusChip(s)}</span>
            <div class="status-track"><div class="status-fill" style="width:${(count / statusTotal) * 100}%"></div></div>
            <b>${count}</b>
          </div>
        `;
      })
      .join("") || "<p class='admin-muted'>Nenhum pedido no período.</p>";

    el.innerHTML = `
      <div class="admin-section-head">
        <h2>Visão geral</h2>
        <div class="admin-filters">
          <input type="date" id="dash-de" value="${de}">
          <input type="date" id="dash-ate" value="${ate}">
          <button class="btn" id="dash-filtrar">Filtrar</button>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <span class="metric-label">Faturamento</span>
          <strong class="metric-value">${money(metrics.revenue)}</strong>
          <span class="metric-sub">${metrics.paidOrders} pedidos pagos</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Pedidos</span>
          <strong class="metric-value">${metrics.totalOrders}</strong>
          <span class="metric-sub">${metrics.cancelledOrders} cancelados</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Ticket médio</span>
          <strong class="metric-value">${money(metrics.averageTicket)}</strong>
          <span class="metric-sub">por pedido</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Clientes</span>
          <strong class="metric-value">${metrics.customers}</strong>
          <span class="metric-sub">cadastrados</span>
        </div>
      </div>

      <div class="admin-cols">
        <div class="admin-card">
          <h3>Faturamento (últimos 14 dias)</h3>
          <div class="bar-chart">${barChart}</div>
        </div>
        <div class="admin-card">
          <h3>Pedidos por status</h3>
          <div class="status-list">${statusBars}</div>
        </div>
      </div>

      <div class="admin-cols">
        <div class="admin-card">
          <h3>Produtos mais vendidos</h3>
          ${topProductsHtml(metrics.topProducts)}
        </div>
        <div class="admin-card">
          <h3>Estoque baixo (≤ 5)</h3>
          ${lowStockHtml(metrics.lowStock)}
        </div>
      </div>

      <div class="admin-card">
        <h3>Últimos pedidos</h3>
        <div class="table-scroll">
          <table class="cart-table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              ${metrics.recentOrders
                .map(
                  (o) => `
                    <tr>
                      <td><strong>#${o.id.slice(0, 8)}</strong></td>
                      <td>${escapeHtml(o.customer_name)}</td>
                      <td>${formatShortDate(o.created_at)}</td>
                      <td>${statusChip(o.status)}</td>
                      <td><b>${money(o.total)}</b></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("dash-filtrar").addEventListener("click", async () => {
      localStorage.setItem("admin_dash_de", document.getElementById("dash-de").value);
      localStorage.setItem("admin_dash_ate", document.getElementById("dash-ate").value);
      await loadDashboard();
    });
  } catch (err) {
    el.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function topProductsHtml(list) {
  if (!list.length) return "<p class='admin-muted'>Sem vendas pagas no período.</p>";
  return `
    <div class="table-scroll">
      <table class="cart-table">
        <thead><tr><th>Produto</th><th>Vendidos</th><th>Receita</th></tr></thead>
        <tbody>
          ${list
            .map(
              (p) => `
                <tr>
                  <td>${escapeHtml(p.name)}</td>
                  <td>${p.sold}</td>
                  <td>${money(p.revenue)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function lowStockHtml(list) {
  if (!list.length) return "<p class='admin-muted'>Estoque saudável.</p>";
  return `
    <div class="table-scroll">
      <table class="cart-table">
        <thead><tr><th>Produto</th><th>Estoque</th></tr></thead>
        <tbody>
          ${list
            .map(
              (p) => `
                <tr>
                  <td>${escapeHtml(p.name)}</td>
                  <td><b class="low-stock">${p.stock}</b></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ============ PEDIDOS ============ */

async function renderPedidos() {
  const el = document.getElementById("sec-pedidos");
  el.innerHTML = `
    <div class="admin-section-head">
      <h2>Pedidos</h2>
      <div class="admin-filters">
        <select id="filtro-status">
          <option value="">Todos os status</option>
          ${Object.keys(ORDER_STATUS)
            .map((s) => `<option value="${s}">${ORDER_STATUS[s]}</option>`)
            .join("")}
        </select>
        <input type="search" id="filtro-busca" placeholder="Cliente, e-mail ou #pedido">
        <button class="btn" id="btn-filtrar">Buscar</button>
      </div>
    </div>
    <div class="admin-loading">Carregando pedidos...</div>
  `;

  document.getElementById("btn-filtrar").addEventListener("click", loadOrdersList);

  const apply = (e) => {
    if (e.key === "Enter") loadOrdersList();
  };
  document.getElementById("filtro-busca").addEventListener("keydown", apply);
  document.getElementById("filtro-status").addEventListener("change", loadOrdersList);

  await loadOrdersList();
}

async function loadOrdersList() {
  const el = document.getElementById("sec-pedidos");
  const status = document.getElementById("filtro-status").value;
  const busca = document.getElementById("filtro-busca").value.trim();
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (busca) qs.set("busca", busca);

  try {
    const { orders } = await API.get(`/admin/orders?${qs}`);

    if (orders.length === 0) {
      el.innerHTML = `
        <div class="admin-section-head">
          <h2>Pedidos</h2>
          <div class="admin-filters">
            <select id="filtro-status">
              <option value="">Todos os status</option>
              ${Object.keys(ORDER_STATUS)
                .map((s) => `<option value="${s}">${ORDER_STATUS[s]}</option>`)
                .join("")}
            </select>
            <input type="search" id="filtro-busca" placeholder="Cliente, e-mail ou #pedido">
            <button class="btn" id="btn-filtrar">Buscar</button>
          </div>
        </div>
        <div class="cart-empty"><h2>Nenhum pedido encontrado</h2></div>
      `;
      document.getElementById("btn-filtrar").addEventListener("click", loadOrdersList);
      return;
    }

    const head = `
      <div class="admin-section-head">
        <h2>Pedidos</h2>
        <div class="admin-filters">
          <select id="filtro-status">
            <option value="">Todos os status</option>
            ${Object.keys(ORDER_STATUS)
              .map((s) => `<option value="${s}" ${status === s ? "selected" : ""}>${ORDER_STATUS[s]}</option>`)
              .join("")}
          </select>
          <input type="search" id="filtro-busca" placeholder="Cliente, e-mail ou #pedido" value="${escapeHtml(busca)}">
          <button class="btn" id="btn-filtrar">Buscar</button>
        </div>
      </div>
    `;

    el.innerHTML =
      head +
      `
      <div class="table-scroll">
        <table class="cart-table">
          <thead>
            <tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Pagamento</th><th>Status</th><th>Total</th><th></th></tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (o) => `
                  <tr>
                    <td><strong>#${o.id.slice(0, 8)}</strong></td>
                    <td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.customer_email)}</small></td>
                    <td>${formatShortDate(o.created_at)}</td>
                    <td>${PAYMENT_METHOD[o.payment_method] || "-"} · ${payChip(o.payment_status)}</td>
                    <td>${statusChip(o.status)}</td>
                    <td><b>${money(o.total)}</b></td>
                    <td><button class="btn btn-outline" data-detalhe="${o.id}">Detalhes</button></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll("[data-detalhe]").forEach((btn) =>
      btn.addEventListener("click", () => showOrderDetail(btn.dataset.detalhe))
    );
    document.getElementById("btn-filtrar").addEventListener("click", loadOrdersList);
    document.getElementById("filtro-busca").addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadOrdersList();
    });
    document.getElementById("filtro-status").addEventListener("change", loadOrdersList);
  } catch (err) {
    el.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

async function showOrderDetail(orderId) {
  const el = document.getElementById("sec-pedidos");
  try {
    const { order, items, payment, tracking } = await API.get(`/admin/orders/${orderId}`);
    const itemRows = items
      .map(
        (i) => `
          <tr>
            <td>${escapeHtml(i.name)}</td>
            <td>${money(i.price)}</td>
            <td>${i.quantity}</td>
            <td>${money(i.price * i.quantity)}</td>
          </tr>
        `
      )
      .join("");

    const canConfirm = payment && payment.status === "pending";
    const canRefund = payment && payment.status === "approved";
    const payDetails = payment
      ? paymentInfoHtml(payment)
      : "<p class='admin-muted'>Sem pagamento registrado.</p>";

    const demoSimulation = isDemo()
      ? `<div class="admin-card" style="border-color:var(--dourado)">
          <h3 style="color:var(--dourado)">Modo demonstração</h3>
          <div class="admin-actions" style="flex-wrap:wrap">
            ${
              canConfirm
                ? `<button class="btn" data-sim="approve_payment">Simular pagamento aprovado</button>
                   <button class="btn btn-outline" data-sim="reject_payment">Simular pagamento recusado</button>`
                : ""
            }
            ${order.shipping_status === "pending" && order.payment_status === "approved" ? `<button class="btn" data-sim="ship">Simular envio</button>` : ""}
            ${order.status === "shipped" ? `<button class="btn btn-outline" data-sim="in_transit">Em trânsito</button>` : ""}
            ${order.status === "in_transit" ? `<button class="btn btn-outline" data-sim="out_for_delivery">Saiu p/ entrega</button>` : ""}
            ${order.status === "out_for_delivery" ? `<button class="btn btn-outline" data-sim="delivered">Entregue</button>` : ""}
          </div>
        </div>`
      : "";

    el.innerHTML = `
      <div class="admin-section-head">
        <h2>Pedido #${order.id.slice(0, 8)} ${statusChip(order.status)}</h2>
        <button class="btn btn-outline" id="btn-voltar">← Voltar para pedidos</button>
      </div>

      <div class="admin-cols">
        <div class="admin-card">
          <h3>Itens</h3>
          <div class="table-scroll">
            <table class="cart-table">
              <thead><tr><th>Produto</th><th>Preço</th><th>Qtd</th><th>Subtotal</th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
          </div>
          <div class="cart-total">
            <span>Subtotal: ${money(order.subtotal)} + Frete: ${money(order.shipping_cost)}</span>
            <strong>Total: ${money(order.total)}</strong>
          </div>
        </div>

        <div class="admin-card">
          <h3>Cliente e entrega</h3>
          <p class="admin-info"><b>Cliente:</b> ${order.customer_name || "-"}</p>
          <p class="admin-info"><b>E-mail:</b> ${order.customer_email || "-"}</p>
          <p class="admin-info"><b>Endereço:</b><br>${escapeHtml(order.shipping_address || "Não informado")}</p>
          <p class="admin-info"><b>CEP:</b> ${order.cep || "-"} <b>Frete:</b> ${escapeHtml(order.shipping_method || "-")}</p>
          <p class="admin-info"><b>Data:</b> ${formatDate(order.created_at)}</p>
          ${order.tracking_code ? `<p class="admin-info"><b>Código de rastreio:</b> ${escapeHtml(order.tracking_code)}</p>` : ""}
        </div>
      </div>

      <div class="admin-cols">
        <div class="admin-card">
          <h3>Pagamento (${PAYMENT_METHOD[payment?.method] || "-"} · ${payChip(order.payment_status)})</h3>
          ${payDetails}
          <div class="admin-actions">
            ${canConfirm ? `<button class="btn" id="btn-confirmar">Confirmar pagamento</button>` : ""}
            ${canRefund ? `<button class="btn" id="btn-estornar">Estornar pagamento</button>` : ""}
          </div>
        </div>

        <div class="admin-card">
          <h3>Status do pedido</h3>
          <div class="status-buttons">
            ${Object.keys(ORDER_STATUS)
              .map(
                (s) =>
                  `<button class="btn btn-outline ${order.status === s ? "active" : ""}" data-status="${s}">${ORDER_STATUS[s]}</button>`
              )
              .join("")}
          </div>
          <h3 style="margin-top:24px">Rastreio</h3>
          <div class="admin-filters">
            <input type="text" id="tracking-input" placeholder="Código de rastreio" value="${escapeHtml(order.tracking_code || "")}">
            <button class="btn" id="btn-tracking">Salvar</button>
          </div>
        </div>
      </div>

      ${demoSimulation}

      <div class="admin-card">
        <h3>Linha do tempo</h3>
        ${timelineHtml(tracking, order.status)}
      </div>
    `;

    document.getElementById("btn-voltar").addEventListener("click", renderPedidos);

    document.querySelectorAll("[data-status]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await API.put(`/admin/orders/${order.id}/status`, { status: btn.dataset.status });
          toast("Status atualizado", "success");
          showOrderDetail(order.id);
        } catch (err) {
          toast(err.message, "error");
        }
      })
    );

    document.getElementById("btn-tracking").addEventListener("click", async () => {
      const code = document.getElementById("tracking-input").value.trim();
      try {
        await API.put(`/admin/orders/${order.id}/tracking`, { tracking_code: code });
        toast("Rastreio salvo", "success");
        showOrderDetail(order.id);
      } catch (err) {
        toast(err.message, "error");
      }
    });

    document.querySelectorAll("[data-sim]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Simulando...";
        try {
          await API.post(`/admin/orders/${order.id}/simulate`, { action: btn.dataset.sim });
          toast("Evento simulado", "success");
          showOrderDetail(order.id);
        } catch (err) {
          toast(err.message, "error");
          btn.disabled = false;
          btn.textContent = "Simular";
        }
      })
    );

    const confirmBtn = document.getElementById("btn-confirmar");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        try {
          await API.post(`/admin/orders/${order.id}/confirm-payment`, {});
          toast("Pagamento confirmado", "success");
          showOrderDetail(order.id);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    }

    const refundBtn = document.getElementById("btn-estornar");
    if (refundBtn) {
      refundBtn.addEventListener("click", async () => {
        if (!confirm("Estornar o pagamento e cancelar este pedido?")) return;
        try {
          await API.post(`/admin/orders/${order.id}/refund`, {});
          toast("Pagamento estornado", "success");
          showOrderDetail(order.id);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    }
  } catch (err) {
    el.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
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

  const current = ORDER_STATUS[status] || status;
  return `<p class="admin-muted">Ainda sem eventos. Status atual: ${current}.</p>`;
}

function isDemo() {
  return appMode === "demo";
}

function paymentInfoHtml(payment) {
  const d = payment.details || {};
  let info = "";
  if (payment.method === "pix" && d.pix_code) {
    info = `
      <p class="admin-info"><b>Chave Pix:</b> pagamentos@braslaminas.com.br</p>
      <div class="code-box"><small>Copie e cole</small><code>${escapeHtml(d.pix_code)}</code></div>
    `;
  } else if (payment.method === "boleto" && d.barcode) {
    info = `
      <p class="admin-info"><b>Linha digitável:</b></p>
      <div class="code-box"><code>${escapeHtml(d.barcode)}</code></div>
      <p class="admin-info"><b>Vencimento:</b> ${formatShortDate(d.due_date)}</p>
    `;
  } else if (payment.method === "credit_card") {
    info = `
      <p class="admin-info"><b>Bandeira:</b> ${escapeHtml(d.card_brand || "-")}</p>
      <p class="admin-info"><b>Cartão:</b> •••• ${escapeHtml(d.card_last4 || "")}</p>
      <p class="admin-info"><b>Titular:</b> ${escapeHtml(d.holder || "-")}</p>
    `;
  }
  return `
    ${info}
    <p class="admin-info"><b>Código da transação:</b> ${escapeHtml(payment.transaction_code || "-")}</p>
    <p class="admin-info"><b>Valor:</b> ${money(payment.amount)}</p>
  `;
}

/* ============ PRODUTOS ============ */

function productRow(product) {
  const image = product.image_url || "/images/produtos/placeholder.svg";
  return `
    <tr>
      <td>
        <img src="${escapeHtml(image)}" style="width:50px;height:50px;object-fit:cover;border-radius:8px"
             onerror="this.src='/images/produtos/placeholder.svg'">
      </td>
      <td><strong>${escapeHtml(product.name)}</strong></td>
      <td>${escapeHtml(product.category || "-")}</td>
      <td>${money(product.price)}</td>
      <td>${product.stock}</td>
      <td>${product.active ? "Ativo" : "Inativo"}</td>
      <td>
        <button class="link" data-edit="${product.id}">Editar</button> |
        <button class="link" data-del="${product.id}">Excluir</button>
      </td>
    </tr>
  `;
}

async function renderProdutos() {
  const el = document.getElementById("sec-produtos");
  el.innerHTML = `
    <div class="admin-section-head">
      <h2>Produtos</h2>
      <button class="btn" id="btn-novo">+ Novo produto</button>
    </div>
    <div id="form-wrapper"></div>
    <div class="table-scroll">
      <table class="cart-table" id="admin-table">
        <thead>
          <tr><th></th><th>Nome</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody id="admin-body"><tr><td colspan="7">Carregando...</td></tr></tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-novo").addEventListener("click", () => openForm());

  const body = document.getElementById("admin-body");
  await loadProducts();

  body.innerHTML = currentProducts.length
    ? currentProducts.map(productRow).join("")
    : '<tr><td colspan="7">Nenhum produto cadastrado.</td></tr>';
  bindProductEvents();
}

function bindProductEvents() {
  document.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const product = currentProducts.find((p) => p.id === btn.dataset.edit);
      openForm(product);
    })
  );
  document.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.del))
  );
}

async function loadProducts() {
  try {
    const { products } = await API.get("/admin/products");
    currentProducts = products;
  } catch (err) {
    showMessage(mensagem, err.message);
    currentProducts = [];
  }
}

async function openForm(product = null) {
  const wrapper = document.getElementById("form-wrapper");
  const cats = cachedCategories.filter((c) => c.active);

  wrapper.innerHTML = `
    <div class="form-card admin-form">
      <h3 style="margin-bottom:16px">${product ? "Editar produto" : "Novo produto"}</h3>
      <div class="admin-form-grid">
        <div class="form-group">
          <label>Nome *</label>
          <input id="f-nome" value="${escapeHtml(product ? product.name : "")}">
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="f-categoria">
            <option value="">Sem categoria</option>
            ${cats
              .map((c) => `<option value="${escapeHtml(c.name)}" ${product && product.category === c.name ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Preço (R$) *</label>
          <input id="f-preco" type="number" step="0.01" min="0" value="${product ? product.price : ""}">
        </div>
        <div class="form-group">
          <label>Estoque *</label>
          <input id="f-estoque" type="number" min="0" value="${product ? product.stock : "0"}">
        </div>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="f-descricao" rows="2">${escapeHtml(product ? product.description || "" : "")}</textarea>
      </div>
      <div class="form-group">
        <label>Ativo</label>
        <select id="f-ativo">
          <option value="true" ${product && !product.active ? "" : "selected"}>Sim</option>
          <option value="false" ${product && !product.active ? "selected" : ""}>Não</option>
        </select>
      </div>
      <div class="form-group">
        <label>Imagem principal</label>
        <input type="file" id="f-imagem" accept="image/*">
        <input type="hidden" id="f-imagem-url" value="${escapeHtml(product ? product.image_url || "" : "")}">
        <div style="margin-top:10px">
          <img id="f-imagem-preview" src="${escapeHtml(product ? product.image_url || "/images/produtos/placeholder.svg" : "/images/produtos/placeholder.svg")}"
               style="max-height:80px;border-radius:8px;border:1px solid #ddd">
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn" id="btn-salvar">Salvar</button>
        <button class="btn btn-outline" id="btn-cancelar">Cancelar</button>
      </div>
    </div>

    ${product ? `<div id="additional-images-section"></div>` : ""}
  `;

  const fileInput = document.getElementById("f-imagem");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const { url } = await API.uploadImage(file);
      document.getElementById("f-imagem-url").value = url;
      document.getElementById("f-imagem-preview").src = url;
      showMessage(mensagem, "Imagem enviada!", "success");
    } catch (err) {
      showMessage(mensagem, err.message);
    }
  });

  document.getElementById("btn-cancelar").addEventListener("click", () => {
    wrapper.innerHTML = "";
  });

  document.getElementById("btn-salvar").addEventListener("click", () => saveProduct(product));

  if (product) {
    loadAdditionalImages(product.id);
  }
}

async function loadAdditionalImages(productId) {
  const section = document.getElementById("additional-images-section");
  if (!section) return;

  try {
    const { images } = await API.get(`/admin/products/${productId}`);
    section.innerHTML = `
      <div class="form-card admin-form" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3>Imagens adicionais (${images.length})</h3>
          <label class="btn btn-outline" style="cursor:pointer">
            + Adicionar imagem
            <input type="file" id="f-add-image" accept="image/*" style="display:none">
          </label>
        </div>
        ${images.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:10px" id="images-grid">
              ${images.map((img, i) => `
                <div style="position:relative;border:1px solid #ddd;border-radius:8px;overflow:hidden" data-img-id="${img.id}">
                  <img src="${escapeHtml(img.image_url)}" style="width:90px;height:90px;object-fit:cover;display:block">
                  <div style="display:flex;border-top:1px solid #ddd">
                    <button class="img-move" data-dir="up" data-idx="${i}" ${i === 0 ? "disabled" : ""} style="flex:1;border:none;background:none;padding:4px;cursor:pointer;font-size:11px">◀</button>
                    <button class="img-move" data-dir="down" data-idx="${i}" ${i === images.length - 1 ? "disabled" : ""} style="flex:1;border:none;background:none;padding:4px;cursor:pointer;font-size:11px">▶</button>
                    <button class="img-del" data-id="${img.id}" style="flex:1;border:none;background:none;padding:4px;cursor:pointer;color:#e53e3e;font-size:11px">✕</button>
                  </div>
                </div>
              `).join("")}
            </div>`
          : '<p style="color:#888">Nenhuma imagem adicional ainda.</p>'}
      </div>
    `;

    document.getElementById("f-add-image").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const { url } = await API.uploadImage(file);
        await API.post(`/admin/products/${productId}/images`, { image_url: url });
        toast("Imagem adicionada", "success");
        loadAdditionalImages(productId);
      } catch (err) {
        toast(err.message, "error");
      }
    });

    section.querySelectorAll(".img-del").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Remover esta imagem?")) return;
        try {
          await API.del(`/admin/products/images/${btn.dataset.id}`);
          toast("Imagem removida", "success");
          loadAdditionalImages(productId);
        } catch (err) {
          toast(err.message, "error");
        }
      })
    );

    section.querySelectorAll(".img-move").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const allIds = Array.from(section.querySelectorAll("[data-img-id]")).map((el) => el.dataset.imgId);
        const idx = parseInt(btn.dataset.idx, 10);
        const swap = btn.dataset.dir === "down" ? idx + 1 : idx - 1;
        if (swap < 0 || swap >= allIds.length) return;
        [allIds[idx], allIds[swap]] = [allIds[swap], allIds[idx]];
        try {
          await API.put(`/admin/products/${productId}/images/reorder`, { image_ids: allIds });
          loadAdditionalImages(productId);
        } catch (err) {
          toast(err.message, "error");
        }
      })
    );
  } catch (err) {
    section.innerHTML = "";
  }
}

async function saveProduct(existing) {
  const payload = {
    name: document.getElementById("f-nome").value.trim(),
    category: document.getElementById("f-categoria").value || null,
    description: document.getElementById("f-descricao").value.trim() || null,
    price: Number(document.getElementById("f-preco").value),
    stock: Number(document.getElementById("f-estoque").value) || 0,
    active: document.getElementById("f-ativo").value === "true",
    image_url: document.getElementById("f-imagem-url").value || null,
  };

  if (!payload.name || isNaN(payload.price)) {
    showMessage(mensagem, "Nome e preço são obrigatórios.");
    return;
  }

  try {
    if (existing) {
      await API.put(`/products/${existing.id}`, payload);
      showMessage(mensagem, "Produto atualizado!", "success");
      toast("Produto salvo", "success");
      await renderProdutos();
    } else {
      const { product } = await API.post("/products", payload);
      showMessage(mensagem, "Produto criado! Agora você pode adicionar imagens.", "success");
      toast("Produto salvo", "success");
      await openForm(product);
    }
  } catch (err) {
    showMessage(mensagem, err.message);
  }
}

async function deleteProduct(id) {
  if (!confirm("Excluir este produto?")) return;
  try {
    await API.del(`/products/${id}`);
    toast("Produto excluído", "success");
    await renderProdutos();
  } catch (err) {
    showMessage(mensagem, err.message);
  }
}

/* ============ CATEGORIAS ============ */

async function renderCategorias() {
  const el = document.getElementById("sec-categorias");
  await loadCategories();

  el.innerHTML = `
    <div class="admin-section-head">
      <h2>Categorias</h2>
    </div>
    <p class="admin-muted">Apenas categorias marcadas como "Exibida na loja" aparecem no menu do site.</p>
    <div class="form-card admin-form" style="max-width:420px">
      <div class="admin-filters">
        <input type="text" id="cat-nome" placeholder="Nova categoria">
        <button class="btn" id="cat-criar">Criar</button>
      </div>
    </div>
    <div class="table-scroll" style="margin-top:20px">
      <table class="cart-table">
        <thead><tr><th>Nome</th><th>Slug</th><th>Produtos</th><th>Exibida na loja</th><th>Ações</th></tr></thead>
        <tbody>
          ${cachedCategories
            .map(
              (c) => `
                <tr>
                  <td><strong>${escapeHtml(c.name)}</strong></td>
                  <td>${escapeHtml(c.slug)}</td>
                  <td>${c.product_count}</td>
                  <td>${c.active ? "<b class='low-stock' style='color:var(--verde-claro)'>Sim</b>" : "Não"}</td>
                  <td>
                    <button class="link" data-editcat="${c.id}">Renomear</button> |
                    <button class="link" data-togglecat="${c.id}" data-ativo="${!c.active}">${c.active ? "Esconder" : "Exibir na loja"}</button> |
                    <button class="link" data-delcat="${c.id}">Excluir</button>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("cat-criar").addEventListener("click", async () => {
    const name = document.getElementById("cat-nome").value.trim();
    if (!name) return;
    try {
      await API.post("/admin/categories", { name });
      toast("Categoria criada", "success");
      await loadCategories();
      renderCategorias();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.querySelectorAll("[data-editcat]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const name = prompt("Novo nome da categoria:");
      if (!name || !name.trim()) return;
      try {
        await API.put(`/admin/categories/${btn.dataset.editcat}`, { name: name.trim() });
        toast("Categoria renomeada", "success");
        await loadCategories();
        renderCategorias();
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );

  document.querySelectorAll("[data-togglecat]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await API.put(`/admin/categories/${btn.dataset.togglecat}`, { active: btn.dataset.ativo === "true" });
        await loadCategories();
        renderCategorias();
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );

  document.querySelectorAll("[data-delcat]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir categoria? Os produtos ficarão sem categoria.")) return;
      try {
        await API.del(`/admin/categories/${btn.dataset.delcat}`);
        toast("Categoria excluída", "success");
        await loadCategories();
        renderCategorias();
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );
}

/* ============ CLIENTES ============ */

async function renderClientes() {
  const el = document.getElementById("sec-clientes");
  el.innerHTML = `
    <div class="admin-section-head">
      <h2>Clientes</h2>
      <div class="admin-filters">
        <input type="search" id="cli-busca" placeholder="Nome ou e-mail">
        <button class="btn" id="cli-buscar">Buscar</button>
        <button class="btn" id="btn-novo-cliente">+ Novo cliente</button>
      </div>
    </div>
    <div id="cliente-form-wrapper"></div>
    <div class="table-scroll">
      <table class="cart-table">
        <thead><tr><th>Cliente</th><th>E-mail</th><th>Cadastro</th><th>Pedidos</th><th>Total gasto</th><th></th></tr></thead>
        <tbody id="cli-body"><tr><td colspan="6">Carregando...</td></tr></tbody>
      </table>
    </div>
  `;

  document.getElementById("cli-buscar").addEventListener("click", loadCustomers);
  document.getElementById("cli-busca").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadCustomers();
  });
  document.getElementById("btn-novo-cliente").addEventListener("click", openCustomerForm);

  await loadCustomers();
}

function openCustomerForm() {
  const wrapper = document.getElementById("cliente-form-wrapper");
  wrapper.innerHTML = `
    <div class="form-card admin-form" style="max-width:420px">
      <h3 style="margin-bottom:16px">Novo cliente</h3>
      <div class="form-group">
        <label>Nome *</label>
        <input id="c-nome" placeholder="Nome completo">
      </div>
      <div class="form-group">
        <label>E-mail *</label>
        <input id="c-email" type="email" placeholder="voce@email.com">
      </div>
      <div class="form-group">
        <label>Senha *</label>
        <input id="c-senha" type="password" placeholder="Mínimo 6 caracteres" minlength="6">
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn" id="btn-salvar-cliente">Salvar</button>
        <button class="btn btn-outline" id="btn-cancelar-cliente">Cancelar</button>
      </div>
    </div>
  `;

  document.getElementById("btn-cancelar-cliente").addEventListener("click", () => {
    wrapper.innerHTML = "";
  });

  document.getElementById("btn-salvar-cliente").addEventListener("click", async () => {
    const name = document.getElementById("c-nome").value.trim();
    const email = document.getElementById("c-email").value.trim();
    const password = document.getElementById("c-senha").value;

    if (!name || !email || password.length < 6) {
      showMessage(mensagem, "Preencha nome, e-mail e senha (mínimo 6 caracteres).");
      return;
    }

    try {
      const { customer } = await API.post("/admin/customers", { name, email, password });
      toast("Cliente criado", "success");
      wrapper.innerHTML = "";
      await renderClientes();
      const body = document.getElementById("cli-body");
      body.innerHTML = `<tr><td colspan="6">Cliente <strong>${escapeHtml(customer.name)}</strong> cadastrado com sucesso.</td></tr>`;
    } catch (err) {
      showMessage(mensagem, err.message);
    }
  });
}

async function loadCustomers() {
  const body = document.getElementById("cli-body");
  const busca = document.getElementById("cli-busca").value.trim();
  const qs = busca ? `?busca=${encodeURIComponent(busca)}` : "";
  try {
    const { customers } = await API.get(`/admin/customers${qs}`);
    body.innerHTML = customers.length
      ? customers
          .map(
            (c) => `
              <tr>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.email)}</td>
                <td>${formatShortDate(c.created_at)}</td>
                <td>${c.order_count}</td>
                <td><b>${money(c.total_spent)}</b></td>
                <td><button class="btn btn-outline" data-cliente="${c.id}">Ver</button></td>
              </tr>
            `
          )
          .join("")
      : '<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>';

    document.querySelectorAll("[data-cliente]").forEach((btn) =>
      btn.addEventListener("click", () => showCustomer(btn.dataset.cliente))
    );
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function showCustomer(id) {
  const el = document.getElementById("sec-clientes");
  try {
    const { customer, orders } = await API.get(`/admin/customers/${id}`);
    el.innerHTML = `
      <div class="admin-section-head">
        <h2>${escapeHtml(customer.name)}</h2>
        <button class="btn btn-outline" id="btn-voltar-cli">← Voltar</button>
      </div>
      <div class="admin-card">
        <p class="admin-info"><b>E-mail:</b> ${escapeHtml(customer.email)}</p>
        <p class="admin-info"><b>Cadastro:</b> ${formatDate(customer.created_at)}</p>
        <p class="admin-info"><b>Total de pedidos:</b> ${orders.length}</p>
      </div>
      <div class="admin-card">
        <h3>Pedidos do cliente</h3>
        <div class="table-scroll">
          <table class="cart-table">
            <thead><tr><th>Pedido</th><th>Data</th><th>Pagamento</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              ${orders
                .map(
                  (o) => `
                    <tr>
                      <td><strong>#${o.id.slice(0, 8)}</strong></td>
                      <td>${formatShortDate(o.created_at)}</td>
                      <td>${PAYMENT_METHOD[o.payment_method] || "-"} · ${payChip(o.payment_status)}</td>
                      <td>${statusChip(o.status)}</td>
                      <td><b>${money(o.total)}</b></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById("btn-voltar-cli").addEventListener("click", renderClientes);
  } catch (err) {
    el.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

/* ============ MENSAGENS ============ */

async function renderMensagens() {
  const el = document.getElementById("sec-mensagens");
  try {
    const { messages } = await API.get("/admin/contact");
    el.innerHTML = `
      <div class="admin-section-head"><h2>Mensagens de contato</h2></div>
      ${messages.length === 0
        ? "<div class='cart-empty'><h2>Nenhuma mensagem</h2></div>"
        : `
      <div class="msg-list">
        ${messages
          .map(
            (m) => `
              <div class="msg-item">
                <div class="msg-item-head">
                  <strong>${escapeHtml(m.name)}</strong>
                  <span>${escapeHtml(m.email)}</span>
                  <small>${formatDate(m.created_at)}</small>
                  <button class="link" data-delmsg="${m.id}">Excluir</button>
                </div>
                <p>${escapeHtml(m.message)}</p>
              </div>
            `
          )
          .join("")}
      </div>
    `}
    `;

    document.querySelectorAll("[data-delmsg]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir esta mensagem?")) return;
        try {
          await API.del(`/admin/contact/${btn.dataset.delmsg}`);
          toast("Mensagem excluída", "success");
          renderMensagens();
        } catch (err) {
          toast(err.message, "error");
        }
      })
    );
  } catch (err) {
    el.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderNavAuth();
  if (requireAdminAccess()) {
    await loadAppMode();
    renderAdmin();
  }
});
