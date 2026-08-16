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

async function loadFeatured() {
  const grid = document.getElementById("grid-produtos");
  const status = document.getElementById("produtos-status");

  grid.innerHTML = [0, 1, 2, 3].map(skeletonCard).join("");

  try {
    const { products } = await API.get("/products?limit=4");
    grid.innerHTML = products.map(productCard).join("");
    if (status) status.style.display = "none";
  } catch (err) {
    if (status) status.textContent = "Não foi possível carregar os produtos.";
    grid.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadFeatured();
  initAddToCart();
});
