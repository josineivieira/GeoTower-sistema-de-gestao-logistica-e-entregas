/**
 * City-specific labels for UI fields
 * Returns the appropriate label name based on the city/region
 */

export function getRecebedorLabel(city = 'manaus') {
  return city === 'itajai' ? 'Remetente' : 'Recebedor';
}

export function getRecebedorPlaceholder(city = 'manaus') {
  return city === 'itajai' ? 'Nome do remetente' : 'Nome do recebedor';
}

export function getRecebedoresLabel(city = 'manaus') {
  return city === 'itajai' ? 'Remetentes' : 'Recebedores';
}

export function getRecebedorErrorMsg(city = 'manaus') {
  return city === 'itajai' ? 'Remetente obrigatório' : 'Recebedor obrigatório';
}

export function getSearchPlaceholder(city = 'manaus') {
  const fieldName = city === 'itajai' ? 'remetente' : 'recebedor';
  return `Buscar processo, container, ${fieldName}...`;
}

export function getDesovaStatusLabel(status, city = 'manaus') {
  if (!status) return '';
  const key = String(status).toUpperCase();

  if (key === 'EM_DESOVA') {
    return city === 'itajai' ? 'EM OVAÇÃO' : 'EM DESOVA';
  }
  if (key === 'DESOVA_FINALIZADA') {
    return city === 'itajai' ? 'OVAÇÃO FINALIZADA' : 'DESOVA FINALIZADA';
  }
  if (key === 'AGUARDANDO_DESOVA') {
    return city === 'itajai' ? 'AGUARD. OVAÇÃO' : 'AGUARD. DESOVA';
  }

  return null;
}

export function getDesovaStepLabel(city = 'manaus') {
  return city === 'itajai' ? 'Ovação' : 'Desova';
}
