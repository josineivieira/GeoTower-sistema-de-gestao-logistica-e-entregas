const DOCUMENT_LABELS = {
  manaus: {
    retiradaCheio: 'Retirada Cheio',
    canhotCTE: 'Canhoto CTE',
    canhotNF: 'Canhoto NF',
    diarioBordo: 'Diario de Bordo',
    devolucaoVazio: 'Entrega CNTR Porto',
    chegadaCliente: 'Chegada no Cliente',
    inicioDesova: 'Inicio da Desova',
    fimDesova: 'Finalizacao da Desova',
    saidaCliente: 'Saida do Cliente',
    chegadaPorto: 'Chegada no Porto',
  },
  itajai: {
    retiradaCheio: 'Retirada Porto',
    canhotCTE: 'CONTRATO',
    canhotNF: 'TACOGRAFO / RIC ABASTECIMENTO',
    diarioBordo: 'Diario de Bordo',
    devolucaoVazio: 'Baixa no Porto',
    chegadaCliente: 'Chegada no Cliente',
    inicioDesova: 'Inicio da Ovacao',
    fimDesova: 'Finalizacao da Ovacao',
    saidaCliente: 'Saida do Cliente',
    chegadaPorto: 'Chegada no Porto',
  },
};

export const getDocumentLabel = (documentType, city = 'manaus') => {
  const cityKey = String(city || 'manaus').toLowerCase();
  return DOCUMENT_LABELS[cityKey]?.[documentType] || DOCUMENT_LABELS.manaus[documentType] || documentType;
};

export const getDocumentLabels = (city = 'manaus') => {
  const cityKey = String(city || 'manaus').toLowerCase();
  return {
    ...DOCUMENT_LABELS.manaus,
    ...(DOCUMENT_LABELS[cityKey] || {}),
  };
};
