const grid = document.getElementById("grid-produtos");
const status = document.getElementById("produtos-status");
const busca = document.getElementById("busca");
const categoria = document.getElementById("categoria");

const initialParams = new URLSearchParams(window.location.search);
const initialCategoria = initialParams.get("categoria");

let allProducts = [];

function skeletonCard() {
  return `
    <div class="card">
      <div class="skeleton" style="height:200px;border-radius:10px"></div>
      <div class="skeleton" style="height:18px;width:60%;margin:14px 0 8px"></div>
      <div class="skeleton" style="height:14px;width:90%"></div>
      <div class="skeleton" style="height:22px;width:40%;margin:12px 0"></div>
    </div>
  `;
}

async function loadProducts() {
  grid.innerHTML = [0, 1, 2, 3, 4, 5].map(skeletonCard).join("");

  try {
    const { products } = await API.get("/products?limit=100");
    allProducts = products;

    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    categories.forEach((c) => {
      const option = document.createElement("option");
      option.value = c;
      option.textContent = c;
      categoria.appendChild(option);
    });

    if (initialCategoria && categories.includes(initialCategoria)) {
      categoria.value = initialCategoria;
    }

    render();
  } catch (err) {
    status.textContent = "Não foi possível carregar os produtos.";
    status.style.display = "block";
  }
}

function render() {
  const term = busca.value.toLowerCase();
  const cat = categoria.value;

  const filtered = allProducts.filter((p) => {
    const matchTerm = !term || p.name.toLowerCase().includes(term);
    const matchCat = !cat || p.category === cat;
    return matchTerm && matchCat;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="cart-empty" style="grid-column:1/-1">
        <h2>Nenhum produto encontrado</h2>
        <p>Tente outro termo ou categoria.</p>
      </div>
    `;
    status.style.display = "none";
    return;
  }

  status.style.display = "none";
  grid.innerHTML = filtered.map(productCard).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const term = initialParams.get("busca");
  if (term) busca.value = term;

  loadProducts();
  initAddToCart();

  busca.addEventListener("input", render);
  categoria.addEventListener("change", render);
});
