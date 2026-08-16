const verificacao = document.getElementById("admin-verificacao");
const mensagem = document.getElementById("mensagem");

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

function productRow(product) {
  const image = product.image_url || "/images/produtos/placeholder.svg";
  return `
    <tr>
      <td>
        <img src="${image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px"
             onerror="this.src='/images/produtos/placeholder.svg'">
      </td>
      <td><strong>${product.name}</strong></td>
      <td>${product.category || "-"}</td>
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

function renderAdmin() {
  verificacao.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h2>Produtos</h2>
      <button class="btn" id="btn-novo">+ Novo produto</button>
    </div>

    <div id="form-wrapper"></div>

    <div class="table-scroll">
      <table class="cart-table" id="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="admin-body">
          <tr><td colspan="7">Carregando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-novo").addEventListener("click", () => openForm());

  const body = document.getElementById("admin-body");
  const bindEvents = () => {
    document.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const product = currentProducts.find((p) => p.id === btn.dataset.edit);
        openForm(product);
      })
    );
    document.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => deleteProduct(btn.dataset.del))
    );
  };

  loadProducts().then((products) => {
    body.innerHTML = products.length
      ? products.map(productRow).join("")
      : '<tr><td colspan="7">Nenhum produto cadastrado.</td></tr>';
    bindEvents();
  });
}

let currentProducts = [];

async function loadProducts() {
  try {
    const { products } = await API.get("/products?limit=100");
    currentProducts = products;
    return products;
  } catch (err) {
    showMessage(mensagem, err.message);
    return [];
  }
}

function openForm(product = null) {
  const wrapper = document.getElementById("form-wrapper");
  wrapper.innerHTML = `
    <div class="form-card" style="max-width:none;margin:0 0 30px">
      <h3 style="margin-bottom:16px">${product ? "Editar produto" : "Novo produto"}</h3>
      <div class="toolbar" style="gap:12px">
        <div class="form-group" style="flex:2">
          <label>Nome *</label>
          <input id="f-nome" value="${product ? product.name : ""}">
        </div>
        <div class="form-group" style="flex:1">
          <label>Categoria</label>
          <input id="f-categoria" value="${product ? product.category || "" : ""}">
        </div>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="f-descricao" rows="2">${product ? product.description || "" : ""}</textarea>
      </div>
      <div class="toolbar" style="gap:12px">
        <div class="form-group" style="flex:1">
          <label>Preço (R$) *</label>
          <input id="f-preco" type="number" step="0.01" min="0" value="${product ? product.price : ""}">
        </div>
        <div class="form-group" style="flex:1">
          <label>Estoque *</label>
          <input id="f-estoque" type="number" min="0" value="${product ? product.stock : "0"}">
        </div>
        <div class="form-group" style="flex:1">
          <label>Ativo</label>
          <select id="f-ativo">
            <option value="true" ${product && !product.active ? "" : "selected"}>Sim</option>
            <option value="false" ${product && !product.active ? "selected" : ""}>Não</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Imagem</label>
        <input type="file" id="f-imagem" accept="image/*">
        <input type="hidden" id="f-imagem-url" value="${product ? product.image_url || "" : ""}">
        <div style="margin-top:10px">
          <img id="f-imagem-preview" src="${product ? product.image_url || "/images/produtos/placeholder.svg" : "/images/produtos/placeholder.svg"}"
               style="max-height:80px;border-radius:8px;border:1px solid #ddd">
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn" id="btn-salvar">Salvar</button>
        <button class="btn btn-outline" id="btn-cancelar">Cancelar</button>
      </div>
    </div>
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
}

async function saveProduct(existing) {
  const payload = {
    name: document.getElementById("f-nome").value.trim(),
    category: document.getElementById("f-categoria").value.trim() || null,
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
    } else {
      await API.post("/products", payload);
    }
    showMessage(mensagem, existing ? "Produto atualizado!" : "Produto criado!", "success");
    document.getElementById("form-wrapper").innerHTML = "";
    renderAdmin();
  } catch (err) {
    showMessage(mensagem, err.message);
  }
}

async function deleteProduct(id) {
  if (!confirm("Excluir este produto?")) return;
  try {
    await API.del(`/products/${id}`);
    showMessage(mensagem, "Produto excluído.", "success");
    renderAdmin();
  } catch (err) {
    showMessage(mensagem, err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavAuth();
  if (requireAdminAccess()) {
    renderAdmin();
  }
});
