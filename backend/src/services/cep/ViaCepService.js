const config = require("../../config");

const VIACEP_URL = "https://viacep.com.br/ws";

function normalizeCep(cep) {
  return String(cep || "").replace(/\D/g, "");
}

/**
 * Serviço de consulta de CEP via ViaCEP.
 * Em modo demo também pode ser usado (API pública gratuita); para desativar,
 * defina VIACEP_ENABLED=false no .env.
 */
class ViaCepService {
  async lookup(cep) {
    const digits = normalizeCep(cep);

    if (!config.viaCepEnabled) {
      const err = new Error("Consulta de CEP desativada na configuração.");
      err.status = 400;
      throw err;
    }

    if (digits.length !== 8) {
      const err = new Error("CEP inválido. Informe 8 dígitos.");
      err.status = 400;
      throw err;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.providerTimeoutMs);

    let response;
    try {
      response = await fetch(`${VIACEP_URL}/${digits}/json/`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      const timeout = err.name === "AbortError";
      const error = new Error(
        timeout ? "Tempo esgotado ao consultar o CEP. Tente novamente." : "Erro ao consultar o CEP."
      );
      error.status = 502;
      throw error;
    } finally {
      clearTimeout(timer);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      const error = new Error("Resposta inválida da API de CEP.");
      error.status = 502;
      throw error;
    }

    if (!response.ok) {
      const error = new Error("A API de CEP retornou um erro.");
      error.status = 502;
      throw error;
    }

    if (data.erro) {
      const error = new Error("CEP não encontrado.");
      error.status = 404;
      throw error;
    }

    return {
      cep: data.cep || digits.replace(/^(\d{5})(\d{3})$/, "$1-$2"),
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      localidade: data.localidade || "",
      uf: data.uf || "",
      complemento: data.complemento || "",
      ibge: data.ibge || "",
      ddd: data.ddd || "",
    };
  }
}

module.exports = new ViaCepService();
