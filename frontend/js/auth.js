const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const mensagem = document.getElementById("mensagem");

function setActiveTab(active) {
  const isLogin = active === "login";
  formLogin.style.display = isLogin ? "block" : "none";
  formRegister.style.display = isLogin ? "none" : "block";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showAuthError(err) {
  if (Array.isArray(err.details) && err.details.length) {
    mensagem.innerHTML = err.details
      .map((d) => `<div>• ${escapeHtml(d.message)}</div>`)
      .join("");
    mensagem.className = "msg msg-error";
  } else {
    showMessage(mensagem, err.message);
  }
}

tabLogin.addEventListener("click", () => setActiveTab("login"));
tabRegister.addEventListener("click", () => setActiveTab("register"));

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensagem.className = "";
  mensagem.textContent = "";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-senha").value;

  try {
    const data = await API.post("/auth/login", { email, password });
    API.setToken(data.token);
    API.setUser(data.user);
    window.location.href = "../index.html";
  } catch (err) {
    showMessage(mensagem, err.message);
  }
});

formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensagem.className = "";
  mensagem.textContent = "";

  const name = document.getElementById("reg-nome").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-senha").value;

  try {
    const data = await API.post("/auth/register", { name, email, password });
    API.setToken(data.token);
    API.setUser(data.user);
    showMessage(mensagem, "Conta criada! Redirecionando...", "success");
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1200);
  } catch (err) {
    showAuthError(err);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  setActiveTab("login");
  if (API.isAuthenticated()) {
    document.getElementById("btn-login").textContent = "Já está logado";
    document.getElementById("btn-login").disabled = true;
  }
});
