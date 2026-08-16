const conteudo = document.getElementById("conteudo-carrinho");
const mensagem = document.getElementById("mensagem");

let cartState = { items: [], total: 0, shippingOption: null, shippingCost: 0 };
let appMode = "production";

async function loadAppMode() {
  try {
    const health = await API.get("/health");
    appMode = health.appMode || "production";
  } catch {
    appMode = "production";
  }
}

function isDemo() {
  return appMode === "demo";
}

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
    cartState = { items, total, shippingOption: null, shippingCost: 0 };
    conteudo.innerHTML = items.length ? cartRows(items, total) : cartEmpty();

    document.getElementById("btn-checkout")?.addEventListener("click", showCheckout);
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

function checkoutSummary() {
  const rows = cartState.items
    .map(
      (item) => `
        <div class="checkout-item">
          <span>${item.quantity}x ${item.name}</span>
          <b>${money(item.subtotal)}</b>
        </div>
      `
    )
    .join("");

  const shippingText = cartState.shippingOption
    ? `${cartState.shippingOption.carrier} - ${cartState.shippingOption.service}`
    : "Selecione o frete";

  return `
    <div class="form-card checkout-card">
      <h3>Resumo do pedido</h3>
      ${rows}
      <div class="checkout-item">
        <span>Frete (${shippingText})</span>
        <b>${cartState.shippingOption ? money(cartState.shippingCost) : "—"}</b>
      </div>
      <div class="cart-total" style="margin-top:12px">
        <span>Total:</span>
        <strong>${money(cartState.total + cartState.shippingCost)}</strong>
      </div>
    </div>
  `;
}

function renderShippingOptions(options) {
  const box = document.getElementById("shipping-options");
  if (!box) return;

  if (!options || !options.length) {
    box.innerHTML = `<p class="cep-status cep-error">Nenhuma opção de frete encontrada.</p>`;
    return;
  }

  box.innerHTML = options
    .map(
      (option, index) => `
        <label class="pay-option shipping-option">
          <input type="radio" name="frete" value="${option.id}" data-price="${option.price}" ${index === 0 ? "checked" : ""}>
          <span>
            <b>${option.carrier} - ${option.service}</b>
            <small>${money(option.price)} • ${option.delivery_days} dia(s) úteis</small>
          </span>
        </label>
      `
    )
    .join("");

  const first = box.querySelector('input[name="frete"]:checked');
  if (first) selectShippingOption(first.value, Number(first.dataset.price));

  box.querySelectorAll('input[name="frete"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      selectShippingOption(radio.value, Number(radio.dataset.price));
    })
  );
}

function selectShippingOption(id, price) {
  cartState.shippingOption = { id };
  cartState.shippingCost = price;
  document.getElementById("frete-status").textContent = "";
  const summary = document.querySelector(".checkout-card");
  if (summary) summary.innerHTML = checkoutSummary();
}

function showCheckout() {
  conteudo.innerHTML = `
    <h2 style="margin-bottom:18px;color:var(--azul)">Finalizar pedido</h2>
    <div class="checkout-layout">
      <div>
        <div class="form-card">
          <h3>Endereço de entrega <span class="required">*</span></h3>
          <div class="form-grid-3">
            <div class="form-group">
              <label>CEP</label>
              <input id="end-cep" inputmode="numeric" placeholder="00000-000" maxlength="9" required>
            </div>
            <div class="form-group form-grid-3-span-2" style="display:flex;align-items:flex-end;padding-bottom:10px">
              <small id="cep-status" class="cep-status"></small>
            </div>
          </div>
          <div class="form-group">
            <label>Rua / Logradouro</label>
            <input id="end-rua" required>
          </div>
          <div class="form-grid-3">
            <div class="form-group">
              <label>Número</label>
              <input id="end-numero" required>
            </div>
            <div class="form-group form-grid-3-span-2">
              <label>Complemento <small>(opcional)</small></label>
              <input id="end-complemento" placeholder="Apto, bloco, referência...">
            </div>
          </div>
          <div class="form-grid-3">
            <div class="form-group form-grid-3-span-2">
              <label>Bairro</label>
              <input id="end-bairro" required>
            </div>
            <div class="form-group">
              <label>UF</label>
              <input id="end-uf" maxlength="2" placeholder="SP" required>
            </div>
          </div>
          <div class="form-group">
            <label>Cidade</label>
            <input id="end-cidade" required>
          </div>
        </div>

        <div class="form-card">
          <h3>Frete</h3>
          <p class="cep-status" id="frete-status">Informe o CEP e clique em "Calcular frete".</p>
          <button class="btn btn-outline" id="btn-calcular-frete" style="margin-top:8px">Calcular frete</button>
          <div id="shipping-options" style="margin-top:12px"></div>
        </div>

        <div class="form-card">
          <h3>Forma de pagamento</h3>
          <div class="pay-options">
            <label class="pay-option">
              <input type="radio" name="pagamento" value="pix" checked>
              <span><b>PIX</b><small>Pagamento imediato</small></span>
            </label>
            <label class="pay-option">
              <input type="radio" name="pagamento" value="credit_card">
              <span><b>Cartão de crédito</b><small>Pagamento imediato</small></span>
            </label>
            <label class="pay-option">
              <input type="radio" name="pagamento" value="boleto">
              <span><b>Boleto</b><small>Pagamento em até 3 dias</small></span>
            </label>
          </div>

          <div id="card-fields" hidden>
            <div class="form-group">
              <label>Número do cartão</label>
              <input id="card-numero" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19">
            </div>
            <div class="form-group">
              <label>Nome do titular</label>
              <input id="card-titular" placeholder="Como está no cartão">
            </div>
            <div class="form-group">
              <label>Validade (MM/AA)</label>
              <input id="card-validade" placeholder="12/28" maxlength="5">
            </div>
            <div class="form-group">
              <label>CVV</label>
              <input id="card-cvv" inputmode="numeric" placeholder="123" maxlength="4">
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:16px">
          <button class="btn" id="btn-pagar">Pagar agora</button>
          <button class="btn btn-outline" id="btn-voltar-carrinho">Voltar</button>
        </div>
      </div>
      ${checkoutSummary()}
    </div>
  `;

  document.getElementById("btn-voltar-carrinho").addEventListener("click", loadCart);
  document.getElementById("btn-calcular-frete").addEventListener("click", calculateShipping);

  document.querySelectorAll('input[name="pagamento"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      document.getElementById("card-fields").hidden = radio.value !== "credit_card";
    })
  );

  const cardNumero = document.getElementById("card-numero");
  cardNumero.addEventListener("input", () => {
    cardNumero.value = cardNumero.value
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  });

  const cepInput = document.getElementById("end-cep");
  cepInput.addEventListener("input", () => {
    cepInput.value = cepInput.value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
  });
  cepInput.addEventListener("blur", async () => {
    const cep = cepInput.value.replace(/\D/g, "");
    if (cep.length === 8) await buscarCep(cep);
  });

  document.getElementById("btn-pagar").addEventListener("click", submitCheckout);
}

async function buscarCep(cep) {
  const status = document.getElementById("cep-status");
  status.textContent = "Buscando endereço...";
  status.className = "cep-status";

  try {
    const data = await API.get(`/cep/${cep}`);
    document.getElementById("end-rua").value = data.logradouro || "";
    document.getElementById("end-bairro").value = data.bairro || "";
    document.getElementById("end-cidade").value = data.localidade || "";
    document.getElementById("end-uf").value = data.uf || "";

    if (data.logradouro) {
      status.textContent = "Endereço preenchido automaticamente.";
      status.className = "cep-status cep-ok";
    } else {
      status.textContent = "CEP encontrado, mas sem logradouro. Preencha o restante.";
      status.className = "cep-status";
    }
  } catch (err) {
    status.textContent = err.status === 404 ? "CEP não encontrado. Preencha manualmente." : err.message || "Não foi possível consultar o CEP.";
    status.className = "cep-status cep-error";
  }
}

function readShippingAddress() {
  const fields = {
    cep: document.getElementById("end-cep"),
    rua: document.getElementById("end-rua"),
    numero: document.getElementById("end-numero"),
    bairro: document.getElementById("end-bairro"),
    cidade: document.getElementById("end-cidade"),
    uf: document.getElementById("end-uf"),
  };

  const missing = Object.keys(fields).filter((key) => !fields[key].value.trim());
  if (missing.length) {
    return { error: "Preencha o endereço de entrega completo (CEP, rua, número, bairro, cidade e UF)." };
  }

  const end = fields;
  const parts = [
    `${end.rua.value.trim()}, ${end.numero.value.trim()}`,
    end.complemento && end.complemento.value.trim() ? end.complemento.value.trim() : null,
    `${end.bairro.value.trim()}, ${end.cidade.value.trim()} - ${end.uf.value.trim().toUpperCase()}`,
    `CEP ${end.cep.value.trim()}`,
  ].filter(Boolean);

  return { address: parts.join(" - "), cep: end.cep.value.replace(/\D/g, "") };
}

async function calculateShipping() {
  const shipping = readShippingAddress();
  if (shipping.error) {
    showMessage(mensagem, shipping.error);
    toast(shipping.error, "error");
    return;
  }

  const button = document.getElementById("btn-calcular-frete");
  button.disabled = true;
  button.textContent = "Calculando...";

  try {
    const data = await API.get(`/shipping/quote?cep_destino=${shipping.cep}`);
    renderShippingOptions(data.options);
    const status = document.getElementById("frete-status");
    status.textContent = "Escolha a opção de frete:";
    status.className = "cep-status cep-ok";
  } catch (err) {
    showMessage(mensagem, err.message);
    toast(err.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Recalcular frete";
  }
}

async function submitCheckout() {
  const method = document.querySelector('input[name="pagamento"]:checked').value;
  const shipping = readShippingAddress();
  if (shipping.error) {
    showMessage(mensagem, shipping.error);
    toast(shipping.error, "error");
    return;
  }

  if (!cartState.shippingOption) {
    const message = "Calcule o frete e escolha uma opção de entrega.";
    showMessage(mensagem, message);
    toast(message, "error");
    return;
  }

  localStorage.setItem("braslaminas_endereco", shipping.address);

  const payload = {
    payment_method: method,
    shipping_address: shipping.address,
    cep: shipping.cep,
    shipping_option_id: cartState.shippingOption.id,
  };

  if (method === "credit_card") {
    const card = {
      number: document.getElementById("card-numero").value,
      holder: document.getElementById("card-titular").value.trim(),
      expiry: document.getElementById("card-validade").value.trim(),
      cvv: document.getElementById("card-cvv").value,
    };
    if (!card.number || !card.holder || !card.expiry || !card.cvv) {
      showMessage(mensagem, "Preencha os dados do cartão.");
      return;
    }
    payload.card = card;
  }

  const button = document.getElementById("btn-pagar");
  button.disabled = true;
  button.textContent = "Processando pagamento...";

  try {
    const { order, payment } = await API.post("/orders", payload);
    showPaymentResult(order, payment);
    updateCartBadge();
  } catch (err) {
    showMessage(mensagem, err.message);
    toast(err.message, "error");
    button.disabled = false;
    button.textContent = "Pagar agora";
  }
}

function paymentInstructions(payment) {
  const d = payment?.details || {};

  if (payment?.method === "pix") {
    return `
      <div class="form-card" style="margin-top:20px">
        <h3>Pague com PIX</h3>
        <p class="payment-note">Escaneie o código ou copie e cole no app do seu banco.</p>
        <div class="code-box">
          <small>PIX Copia e Cola</small>
          <code id="pix-code">${d.pix_code || ""}</code>
        </div>
        <button class="btn" id="btn-copiar-pix">Copiar código</button>
      </div>
    `;
  }

  if (payment?.method === "boleto") {
    return `
      <div class="form-card" style="margin-top:20px">
        <h3>Pague com boleto</h3>
        <p class="payment-note">Vencimento: <b>${new Date(d.due_date).toLocaleDateString("pt-BR")}</b>.</p>
        <div class="code-box">
          <small>Linha digitável</small>
          <code id="barcode-code">${d.barcode || ""}</code>
        </div>
        <button class="btn" id="btn-copiar-boleto">Copiar linha digitável</button>
      </div>
    `;
  }

  if (payment?.method === "credit_card") {
    return `
      <div class="form-card" style="margin-top:20px">
        <h3>Cartão de crédito</h3>
        <p class="payment-note">Cartão •••• ${d.card_last4 || "—"} • Autorização: <b>${payment.transaction_code || ""}</b></p>
      </div>
    `;
  }

  return "";
}

function demoActions(order) {
  return `
    <div class="form-card" style="margin-top:20px;border-color:var(--dourado)">
      <h3 style="color:var(--dourado)">Modo demonstração</h3>
      <p class="payment-note">Simule a confirmação do pagamento como se o gateway tivesse notificado o backend:</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn" id="btn-sim-aprovar" data-outcome="approved">Simular pagamento aprovado</button>
        <button class="btn btn-outline" id="btn-sim-recusar" data-outcome="rejected">Simular pagamento recusado</button>
      </div>
    </div>
  `;
}

function showPaymentResult(order, payment) {
  const paymentBox = paymentInstructions(payment);
  const demoBox = isDemo() ? demoActions(order) : "";
  const badge = order.payment_status === "approved" ? "confirmado" : "criado";

  conteudo.innerHTML = `
    <div class="cart-empty" style="padding:40px 0">
      <h2>Pedido ${order.id.slice(0, 8)} ${badge}!</h2>
      <p>${order.payment_status === "approved" ? "Pagamento aprovado. Acompanhe seu pedido em Minha Conta." : "Aguardando pagamento."}</p>
    </div>
    ${paymentBox}
    ${demoBox}
    <div id="sim-result"></div>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
      <a class="btn" href="pedidos.html">Acompanhar pedido</a>
      <a class="btn btn-outline" href="produtos.html">Continuar comprando</a>
    </div>
  `;

  document.getElementById("btn-copiar-pix")?.addEventListener("click", () => {
    navigator.clipboard.writeText(payment?.details?.pix_code || "").then(() => toast("Código PIX copiado!", "success"));
  });
  document.getElementById("btn-copiar-boleto")?.addEventListener("click", () => {
    navigator.clipboard.writeText(payment?.details?.barcode || "").then(() => toast("Linha digitável copiada!", "success"));
  });

  document.querySelectorAll("[data-outcome]").forEach((btn) =>
    btn.addEventListener("click", () => simulatePayment(order.id, btn.dataset.outcome, btn))
  );
}

async function simulatePayment(orderId, outcome, button) {
  button.disabled = true;
  button.textContent = "Simulando...";

  try {
    const result = await API.post(`/orders/${orderId}/simulate-payment`, { outcome });
    const status = document.getElementById("sim-result");
    const approved = result.order.payment_status === "approved";
    status.innerHTML = `
      <div class="cep-status ${approved ? "cep-ok" : "cep-error"}" style="font-size:15px;margin-top:8px">
        Pagamento ${approved ? "aprovado!" : "recusado."} O pedido agora está <b>${result.order.status}</b>.
      </div>
    `;
    toast(approved ? "Pagamento aprovado!" : "Pagamento recusado", approved ? "success" : "error");
    document.querySelectorAll("[data-outcome]").forEach((btn) => btn.remove());
  } catch (err) {
    toast(err.message, "error");
    button.disabled = false;
    button.textContent = "Simular novamente";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAppMode();
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
