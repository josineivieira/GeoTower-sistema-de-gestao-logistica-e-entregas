// Helper to decide which date field to use as the "scheduled" date.
// For Itajaí, we prefer `dtColeta` (coleta date) when available.
// For other cities, we fall back to `dataAgendamento` (agendamento) and then to other fields.

export function getProgramacaoDate(programacao = {}, city = 'manaus') {
  if (!programacao) return null;

  // Prefer dtColeta in Itajaí when present
  if (city === 'itajai' && programacao.dtColeta) {
    console.log(`[getProgramacaoDate] city=${city} - Retornando dtColeta:`, programacao.dtColeta, `(dataAgendamento: ${programacao.dataAgendamento})`);
    return programacao.dtColeta;
  }

  // Fallbacks
  const result = programacao.dataAgendamento || programacao.dtColeta || programacao.data || null;
  if (city === 'itajai') {
    console.log(`[getProgramacaoDate] city=${city} - dtColeta não encontrado, retornando fallback:`, result);
  }
  return result;
}
