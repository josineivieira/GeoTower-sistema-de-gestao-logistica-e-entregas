// Helper to decide which date field to use as the "scheduled" date.
// For Itajaí, we prefer `dtColeta` (coleta date) when available.
// For other cities, we fall back to `dataAgendamento` (agendamento) and then to other fields.

export function getProgramacaoDate(programacao = {}, city = 'manaus') {
  if (!programacao) return null;

  // Prefer dtColeta in Itajaí when present
  if (city === 'itajai' && programacao.dtColeta) {
    return programacao.dtColeta;
  }

  // Fallbacks
  return programacao.dataAgendamento || programacao.dtColeta || programacao.data || null;
}
