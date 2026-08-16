/* ============ SLIDER PRINCIPAL ============ */

const SLIDES = [
  {
    title: "Microscópios para laboratório",
    subtitle: "Precisão para suas análises",
    features: ["Óptica de alta qualidade", "Iluminação LED", "Estrutura profissional", "Excelente estabilidade"],
    cards: ["Lâmina Histológica", "Kit Laboratório", "Lamínulas 24x32mm"],
  },
  {
    title: "Lâminas de alta qualidade",
    subtitle: "Cortes precisos para a sua rotina",
    features: ["Vidro fosco com face de escrita", "Bordas lapidadas", "Alta transparência", "Embalagens lacradas"],
    cards: ["Lâmina de Vidro Fosco", "Caixa para Lâminas 100 un", "Corante Hematoxilina-Eosina"],
  },
  {
    title: "Equipamentos de laboratório",
    subtitle: "Tecnologia para resultados confiáveis",
    features: ["Calibração de fábrica", "Materiais resistentes", "Fácil manutenção", "Garantia estendida"],
    cards: ["Kit Laboratório", "Lamínulas 24x32mm", "Lâmina Histológica"],
  },
  {
    title: "Acessórios e insumos",
    subtitle: "Tudo o que o seu laboratório precisa",
    features: ["Armazenagem segura", "Compatibilidade universal", "Custo-benefício", "Pronta entrega"],
    cards: ["Caixa para Lâminas 100 un", "Corante Hematoxilina-Eosina", "Lâmina de Vidro Fosco"],
  },
  {
    title: "Reagentes e corantes",
    subtitle: "Precisão em cada análise",
    features: ["Alta pureza", "Fórmula padronizada", "Reprodutibilidade", "Validade prolongada"],
    cards: ["Corante Hematoxilina-Eosina", "Lâmina Histológica", "Kit Laboratório"],
  },
];

function slideHTML(slide, index) {
  return `
    <div class="slide ${index === 0 ? "active" : ""}">
      <div class="slide-geo"></div>
      <div class="container slide-inner">
        <div class="slide-text">
          <h2>${slide.title}</h2>
          <p class="slide-sub">${slide.subtitle}</p>
          <ul class="slide-features">
            ${slide.features.map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <a class="btn btn-green" href="pages/produtos.html">SAIBA MAIS</a>
        </div>
        <div class="slide-img">
          <img src="images/banners/microscopio.svg" alt="Microscópio para laboratório">
        </div>
      </div>
      <div class="slide-cards">
        <div class="container">
          <div class="slide-cards-row">
            ${slide.cards
              .map(
                (name) => `
              <div class="mini-card">
                <span class="mini-card-img">
                  <img src="/images/produtos/placeholder.svg" alt="${name}">
                </span>
                <span class="mini-card-info">
                  <span class="mini-card-name">${name}</span>
                  <span class="mini-card-price" data-name="${name}">Ver detalhes</span>
                </span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

let currentSlide = 0;
let sliderTimer = null;
const SLIDE_DELAY = 6000;

function buildSlider() {
  const slider = document.getElementById("hero-slider");
  const dots = document.getElementById("slider-dots");
  if (!slider || !dots) return;

  slider.innerHTML = SLIDES.map(slideHTML).join("");
  dots.innerHTML = SLIDES.map((_, i) =>
    `<button class="slider-dot ${i === 0 ? "active" : ""}" data-slide="${i}" aria-label="Ir para o slide ${i + 1}"></button>`
  ).join("");

  document.getElementById("slider-prev").addEventListener("click", prevSlide);
  document.getElementById("slider-next").addEventListener("click", nextSlide);

  dots.querySelectorAll(".slider-dot").forEach((dot) => {
    dot.addEventListener("click", () => goToSlide(Number(dot.dataset.slide)));
  });
}

function goToSlide(index) {
  const slides = document.querySelectorAll(".hero-slider .slide");
  const dots = document.querySelectorAll(".slider-dot");
  if (!slides.length) return;

  currentSlide = (index + slides.length) % slides.length;
  slides.forEach((s, i) => s.classList.toggle("active", i === currentSlide));
  dots.forEach((d, i) => d.classList.toggle("active", i === currentSlide));
}

function nextSlide() {
  goToSlide(currentSlide + 1);
}

function prevSlide() {
  goToSlide(currentSlide - 1);
}

function startSlider() {
  buildSlider();
  goToSlide(0);
  sliderTimer = setInterval(nextSlide, SLIDE_DELAY);

  const hero = document.getElementById("hero");
  if (hero) {
    hero.addEventListener("mouseenter", () => clearInterval(sliderTimer));
    hero.addEventListener("mouseleave", () => {
      clearInterval(sliderTimer);
      sliderTimer = setInterval(nextSlide, SLIDE_DELAY);
    });
  }
}

/* ============ MENU "NAVEGUE PELA LOJA" (compartilhado em app.js) ============ */

/* ============ BUSCA DA HOME (compartilhado em app.js) ============ */

/* ============ CARRINHO FIXO (compartilhado em app.js) ============ */

/* ============ PREÇOS DOS MINI CARDS DO SLIDER ============ */

function fillMiniPrices(products) {
  document.querySelectorAll(".mini-card-price[data-name]").forEach((el) => {
    const product = products.find((p) => p.name === el.dataset.name);
    if (product) el.textContent = `a partir de ${money(product.price)}`;
  });
}

/* ============ PRODUTOS EM DESTAQUE ============ */

function skeletonCard() {
  return `
    <div class="card">
      <div class="skeleton" style="height:220px;border-radius:10px"></div>
      <div class="skeleton" style="height:18px;width:60%;margin:14px 0 8px"></div>
      <div class="skeleton" style="height:14px;width:90%"></div>
      <div class="skeleton" style="height:22px;width:40%;margin:12px 0"></div>
    </div>
  `;
}

async function loadFeatured() {
  const grid = document.getElementById("grid-produtos");
  const status = document.getElementById("produtos-status");
  if (!grid) return;

  grid.innerHTML = [0, 1, 2, 3].map(skeletonCard).join("");

  try {
    const { products } = await API.get("/products?limit=4");
    grid.innerHTML = products.map(productCard).join("");
    fillMiniPrices(products);
    if (status) status.style.display = "none";
  } catch (err) {
    if (status) status.textContent = "Não foi possível carregar os produtos.";
    grid.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  startSlider();
  loadFeatured();
  initAddToCart();
});
