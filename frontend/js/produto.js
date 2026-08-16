const conteudo = document.getElementById("produto-conteudo");

let currentImageIndex = 0;
let allImages = [];

function productDetail(product, images) {
  const mainImage = product.image_url || "/images/produtos/placeholder.svg";
  allImages = [mainImage, ...images.map((i) => i.image_url)];
  currentImageIndex = 0;
  const available = product.stock > 0;

  return `
    <div class="detail">
      <div class="detail-img">
        <div class="gallery">
          <img id="gallery-main" src="${mainImage}" alt="${product.name}"
               onerror="this.src='/images/produtos/placeholder.svg'"
               style="max-height:340px;border-radius:14px;object-fit:contain">
          ${allImages.length > 1
            ? `<div class="gallery-thumbs" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                ${allImages.map((img, i) => `
                  <img src="${img}" class="gallery-thumb ${i === 0 ? "active" : ""}"
                       data-idx="${i}"
                       style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:2px solid ${i === 0 ? "var(--azul)" : "#ddd"};cursor:pointer">
                `).join("")}
              </div>`
            : ""}
        </div>
      </div>
      <div class="detail-info">
        <h2>${product.name}</h2>
        <p class="category-tag">${product.category || "Sem categoria"}</p>
        <p class="detail-desc">${product.description || "Sem descrição."}</p>
        <p class="preco">${money(product.price)}</p>
        <p class="stock-info">
          ${available
            ? `<span class="in-stock">● Em estoque — ${product.stock} unidade(s)</span>`
            : `<span class="out-stock">● Esgotado</span>`}
        </p>

        ${available ? `
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div class="qty-controls">
              <button id="qty-dec">-</button>
              <span id="qty-value">1</span>
              <button id="qty-inc">+</button>
            </div>
            <button class="btn" id="btn-add" data-add-to-cart="${product.id}">Adicionar ao carrinho</button>
          </div>
        ` : `
          <button class="btn" disabled>Esgotado</button>
        `}
      </div>
    </div>
  `;
}

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    conteudo.innerHTML = "<p>Produto não informado.</p>";
    return;
  }

  conteudo.innerHTML = `
    <div class="detail">
      <div class="detail-img">
        <div class="skeleton" style="height:340px;border-radius:14px"></div>
      </div>
      <div class="detail-info">
        <div class="skeleton" style="height:32px;width:70%;margin-bottom:14px"></div>
        <div class="skeleton" style="height:16px;width:40%;margin-bottom:20px"></div>
        <div class="skeleton" style="height:16px;width:100%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:16px;width:90%;margin-bottom:20px"></div>
        <div class="skeleton" style="height:34px;width:45%"></div>
      </div>
    </div>
  `;

  try {
    const { product, images } = await API.get(`/products/${slug}`);
    conteudo.innerHTML = productDetail(product, images);
    bindQty();
    bindGallery();
    initAddToCart();
  } catch (err) {
    conteudo.innerHTML = `<p>${err.message}</p>`;
  }
}

function bindGallery() {
  const thumbs = document.querySelectorAll(".gallery-thumb");
  if (!thumbs.length) return;

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const idx = parseInt(thumb.dataset.idx, 10);
      document.getElementById("gallery-main").src = allImages[idx];
      currentImageIndex = idx;
      thumbs.forEach((t, i) => {
        t.style.borderColor = i === idx ? "var(--azul)" : "#ddd";
        t.classList.toggle("active", i === idx);
      });
    });
  });
}

function bindQty() {
  const dec = document.getElementById("qty-dec");
  const inc = document.getElementById("qty-inc");
  const value = document.getElementById("qty-value");
  const add = document.getElementById("btn-add");

  if (!dec) return;

  dec.addEventListener("click", () => {
    const next = Math.max(1, Number(value.textContent) - 1);
    value.textContent = next;
    add.dataset.quantity = next;
  });

  inc.addEventListener("click", () => {
    const next = Number(value.textContent) + 1;
    value.textContent = next;
    add.dataset.quantity = next;
  });

  add.dataset.quantity = 1;
}

document.addEventListener("DOMContentLoaded", loadProduct);
