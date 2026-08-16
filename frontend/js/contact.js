const form = document.getElementById("form-contato");
const mensagem = document.getElementById("mensagem");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensagem.className = "";
  mensagem.textContent = "";

  const payload = {
    name: document.getElementById("ct-nome").value.trim(),
    email: document.getElementById("ct-email").value.trim(),
    message: document.getElementById("ct-mensagem").value.trim(),
  };

  try {
    await API.post("/contact", payload);
    showMessage(mensagem, "Mensagem enviada! Em breve entraremos em contato.", "success");
    form.reset();
  } catch (err) {
    showMessage(mensagem, err.message);
  }
});
