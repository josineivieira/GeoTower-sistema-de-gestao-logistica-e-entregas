/**
 * Helper para formatação de datas padronizada no projeto
 * Respeita o fuso horário da cidade da entrega
 */

/**
 * Formata data/hora considerando o fuso horário da cidade
 * @param {string|Date} date - Data a ser formatada
 * @param {string} cityCode - Código da cidade ('manaus' ou 'itajai')
 * @param {object} options - Opções para toLocaleString
 * @returns {string} Data formatada em pt-BR com fuso correto
 */
export function formatarData(date, cityCode, options = {}) {
  if (!date) return "-";

  const timezone =
    cityCode === "manaus"
      ? "America/Manaus"
      : "America/Sao_Paulo";

  return new Date(date).toLocaleString("pt-BR", {
    timeZone: timezone,
    ...options
  });
}

/**
 * Formata apenas a data (sem hora) considerando o fuso horário
 * @param {string|Date} date - Data a ser formatada
 * @param {string} cityCode - Código da cidade ('manaus' ou 'itajai')
 * @param {object} options - Opções para toLocaleDateString
 * @returns {string} Data formatada em pt-BR com fuso correto
 */
export function formatarDataApenas(date, cityCode, options = {}) {
  if (!date) return "-";

  const timezone =
    cityCode === "manaus"
      ? "America/Manaus"
      : "America/Sao_Paulo";

  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: timezone,
    ...options
  });
}

/**
 * Formata apenas a hora considerando o fuso horário
 * @param {string|Date} date - Data a ser formatada
 * @param {string} cityCode - Código da cidade ('manaus' ou 'itajai')
 * @param {object} options - Opções para toLocaleTimeString
 * @returns {string} Hora formatada em pt-BR com fuso correto
 */
export function formatarHora(date, cityCode, options = {}) {
  if (!date) return "-";

  const timezone =
    cityCode === "manaus"
      ? "America/Manaus"
      : "America/Sao_Paulo";

  return new Date(date).toLocaleTimeString("pt-BR", {
    timeZone: timezone,
    ...options
  });
}

/**
 * Formata data/hora usando fuso horário local do navegador (para datas gerais)
 * @param {string|Date} date - Data a ser formatada
 * @param {object} options - Opções para toLocaleString
 * @returns {string} Data formatada em pt-BR com fuso local
 */
export function formatarDataLocal(date, options = {}) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR", options);
}

/**
 * Formata apenas data usando fuso horário local
 * @param {string|Date} date - Data a ser formatada
 * @param {object} options - Opções para toLocaleDateString
 * @returns {string} Data formatada em pt-BR com fuso local
 */
export function formatarDataApenasLocal(date, options = {}) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", options);
}

/**
 * Formata agendamento preservando horário local da operação
 * @param {string|Date} date - Data do agendamento (já em horário local)
 * @returns {string} Data formatada em pt-BR com fuso local
 */
export function formatarAgendamento(date) {
  if (!date) return "-";
  return formatarDataLocal(date);
}