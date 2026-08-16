const conteudo = document.getElementById("conteudo-carrinho");
const mensagem = document.getElementById("mensagem");

let cartState = { items: [], total: 0 };

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
    cartState = { items, total };
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
  return `
    <div class="form-card checkout-card">
      <h3>Resumo do pedido</h3>
      ${rows}
      <div class="cart-total" style="margin-top:12px">
        <span>Total:</span>
        <strong>${money(cartState.total)}</strong>
      </div>
    </div>
  `;
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
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();

    if (!res.ok || data.erro) {
      status.textContent = "CEP não encontrado. Preencha manualmente.";
      status.className = "cep-status cep-error";
      return;
    }

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
  } catch {
    status.textContent = "Não foi possível consultar o CEP. Preencha manualmente.";
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

  return { address: parts.join(" - ") };
}

async function submitCheckout() {
  const method = document.querySelector('input[name="pagamento"]:checked').value;
  const shipping = readShippingAddress();
  if (shipping.error) {
    showMessage(mensagem, shipping.error);
    toast(shipping.error, "error");
    return;
  }
  localStorage.setItem("braslaminas_endereco", shipping.address);

  const payload = { payment_method: method, shipping_address: shipping.address };

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

function showPaymentResult(order, payment) {
  const d = payment?.details || {};
  let paymentBox = "";

  if (payment?.method === "pix") {
    paymentBox = `
      <div class="form-card" style="margin-top:20px">
        <h3>Pague com PIX</h3>
        <p class="payment-note">Escaneie o código ou copie e cole no app do seu banco. O pedido é confirmado automaticamente.</p>
        <div class="code-box">
          <small>PIX Copia e Cola</small>
          <code id="pix-code">${d.pix_code || ""}</code>
        </div>
        <button class="btn" id="btn-copiar-pix">Copiar código</button>
      </div>
    `;
  } else if (payment?.method === "boleto") {
    paymentBox = `
      <div class="form-card" style="margin-top:20px">
        <h3>Pague com boleto</h3>
        <p class="payment-note">Vencimento: <b>${new Date(d.due_date).toLocaleDateString("pt-BR")}</b>. O pedido será confirmado após o pagamento ser compensado.</p>
        <div class="code-box">
          <small>Linha digitável</small>
          <code id="barcode-code">${d.barcode || ""}</code>
        </div>
        <button class="btn" id="btn-copiar-boleto">Copiar linha digitável</button>
      </div>
    `;
  } else if (payment?.method === "credit_card") {
    paymentBox = `
      <div class="form-card" style="margin-top:20px">
        <h3>Pagamento aprovado</h3>
        <p class="payment-note">Autorização: <b>${payment.transaction_code || ""}</b></p>
        <p class="payment-note">Cartão •••• ${d.card_last4 || ""}</p>
      </div>
    `;
  }

  conteudo.innerHTML = `
    <div class="cart-empty" style="padding:40px 0">
      <h2>Pedido ${order.id.slice(0, 8)} ${order.status === "paid" ? "confirmado" : "criado"}!</h2>
      <p>${order.status === "paid" ? "Pagamento aprovado. Acompanhe seu pedido em Minha Conta." : "Aguardando pagamento. Você pode acompanhar o pedido em Minha Conta."}</p>
    </div>
    ${paymentBox}
    <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
      <a class="btn" href="pedidos.html">Acompanhar pedido</a>
      <a class="btn btn-outline" href="produtos.html">Continuar comprando</a>
    </div>
  `;

  document.getElementById("btn-copiar-pix")?.addEventListener("click", () => {
    navigator.clipboard.writeText(d.pix_code || "").then(() => toast("Código PIX copiado!", "success"));
  });
  document.getElementById("btn-copiar-boleto")?.addEventListener("click", () => {
    navigator.clipboard.writeText(d.barcode || "").then(() => toast("Linha digitável copiada!", "success"));
  });
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
