import React, { useState, useMemo } from 'react';
import {
  FaTimes, FaCheckCircle, FaTimesCircle, FaCalendarAlt, FaClock, 
  FaBox, FaTruck, FaExclamationTriangle, FaShareAlt, FaDownload,
  FaEye, FaTrash, FaEdit, FaUndo, FaMapMarkerAlt, FaShippingFast,
  FaFilePdf, FaUsers, FaDolly, FaSearch, FaBuilding, FaLayerGroup,
  FaUser, FaBoxOpen, FaFileAlt
} from 'react-icons/fa';
import { getDesovaStatusLabel, getDesovaStepLabel } from '../utils/cityLabels';
import { formatarData, formatarAgendamento, formatarHora } from '../utils/date';
import { getDocumentLabel } from '../utils/documentLabels';

const Badge = ({ status, city = 'manaus' }) => {
  const getResolveConfig = (rawStatus, cityCode = 'manaus') => {
    const statusConfig = getStatusConfig(cityCode);
    const key = normalizeKey(rawStatus);
    if (key === 'ENTREGUE' || key === 'SUBMITTED' || key === 'ENTREGUE COM PENDENCIA CANHOTO') {
      return statusConfig['ENTREGUE'];
    }
    if (key === 'PENDING' || key === 'A CAMINHO DO CLIENTE') {
      return statusConfig['A CAMINHO DO CLIENTE'];
    }
    return statusConfig[key] || null;
  };

  const normalizeKey = (s) => {
    if (!s) return '';
    return String(s).replace(/_/g, ' ').toUpperCase().trim();
  };

  const getStatusConfig = (city = 'manaus') => {
    const desovaLabel = getDesovaStepLabel(city);
    return {
      AGENDADO: {
        label: 'Não Iniciado',
        badge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
      },
      'CONTAINER MONTADO': {
        label: 'Container Montado',
        badge: 'bg-sky-100 text-sky-800 border border-sky-300',
      },
      'A CAMINHO DO CLIENTE': {
        label: 'A Caminho do Cliente',
        badge: 'bg-amber-100 text-amber-800 border border-amber-300',
      },
      'AGUARDANDO DESOVA': {
        label: 'Aguard. Desova/Ovação',
        badge: 'bg-orange-100 text-orange-800 border border-orange-300',
      },
      'EM DESOVA': {
        label: `Em ${desovaLabel}`,
        badge: 'bg-violet-100 text-violet-800 border border-violet-300',
      },
      'ANEXANDO DOCUMENTOS FINAIS': {
        label: 'Anexando Docs',
        badge: 'bg-pink-100 text-pink-800 border border-pink-300',
      },
      ENTREGUE: {
        label: 'Entregue',
        badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      },
      CANCELADO: {
        label: 'Cancelado',
        badge: 'bg-gray-100 text-gray-600 border border-gray-300',
      }
    };
  };

  const cfg = getResolveConfig(status, city);
  const label = cfg?.label || normalizeKey(status);
  const cls = cfg?.badge || 'bg-gray-100 text-gray-700 border border-gray-300';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const DeliveryModal = ({
  selectedDelivery,
  onClose,
  city = 'manaus',
  selectedSentido = 'DESTINO',
  icompanyVerified,
  setIcompanyVerified,
  icompanyRemoteRecord,
  icompanyLookupStatus,
  controleProtocolosRecord,
  controleProtocolosLookupStatus,
  findIcompanyInCache,
  compareWithIcompany,
  allModalDocsComplete,
  getFlowHistory,
  getDocumentUrlsArray,
  getLabelsForDelivery,
  removeProgramacaoInfo,
  getProgramacaoDate,
  handleDownload,
  handleDownloadAll,
  handleShareDelivery,
  handleEditStart,
  handleDelete,
  onRemoveDocument,
  canRemoveDocument,
  updateVerificationWithServer,
  setToast,
  setViewingDocument,
  setModalFotos,
  editingDelivery,
  editForm,
  setEditingDelivery,
  setEditForm,
  handleEditSave,
  userName,
  currentTime,
  deliveryToUnverify,
  setDeliveryToUnverify,
  confirmRemoveVerification,
  setConfirmRemoveVerification
}) => {
  if (!selectedDelivery) return null;

  const getPartyBySentido = (delivery, sentido = 'DESTINO') => {
    const sentidoKey = String(sentido || '').trim().toUpperCase();
    const remetenteValue = String(delivery?.remetente || '').trim();
    const destinatarioValue = String(delivery?.destinatario || delivery?.recebedor || '').trim();
    if (sentidoKey === 'ORIGEM') return remetenteValue || destinatarioValue || '—';
    return destinatarioValue || remetenteValue || '—';
  };

  const getPartyLabelBySentido = (sentido = 'DESTINO') =>
    String(sentido || '').trim().toUpperCase() === 'ORIGEM' ? 'Remetente' : 'Recebedor';

  const getDesovaLabelBySentido = (sentido = 'DESTINO') =>
    String(sentido || '').trim().toUpperCase() === 'ORIGEM' ? 'Ovação' : 'Desova';

  const getDocumentKeysBySentido = (sentido = 'DESTINO') => {
    const sentidoKey = String(sentido || '').trim().toUpperCase();
    const commonDocs = ['retiradaCheio'];
    const finalDocs = sentidoKey === 'ORIGEM'
      ? ['canhotCTE', 'canhotNF', 'diarioBordo']
      : ['canhotCTE', 'canhotNF', 'diarioBordo'];
    const returnDocs = ['devolucaoVazio'];
    return [...commonDocs, ...finalDocs, ...returnDocs];
  };

  const getLabelsBySentido = (delivery, sentido = 'DESTINO') => {
    const labels = getLabelsForDelivery(delivery);
    const sentidoKey = String(sentido || '').trim().toUpperCase();
    if (sentidoKey === 'ORIGEM') {
      return {
        ...labels,
        canhotCTE: 'CONTRATO',
        canhotNF: 'TACÓGRAFO / RIC ABASTECIMENTO',
        diarioBordo: 'Diário de Bordo',
        inicioDesova: 'Início da Ovação',
        fimDesova: 'Finalização da Ovação',
      };
    }
    return {
      ...labels,
      canhotCTE: 'Canhoto CTE',
      canhotNF: 'Canhoto NF',
      diarioBordo: 'Diário de Bordo',
      inicioDesova: 'Início da Desova',
      fimDesova: 'Finalização da Desova',
    };
  };

  const flowHistory = getFlowHistory(selectedDelivery);
  const normalizeKey = (s) => {
    if (!s) return '';
    return String(s).replace(/_/g, ' ').toUpperCase().trim();
  };

  const controleProtocolosDocumentMap = {
    retiradaCheio: 'RIC PORTO DESTINO',
    canhotCTE: 'COMPROVANTE DE DESOVA',
    diarioBordo: 'DIARIO DE BORDO',
    canhotNF: 'CANHOTO DE DANFE',
    devolucaoVazio: 'RIC DEPOT DESTINO'
  };

  const isControleDocumentoPresent = (value) => {
    return value === true;
  };

  const getIcompanyDocumentMap = (sentido = 'DESTINO') => {
    const sentidoKey = String(sentido || '').trim().toUpperCase();
    if (sentidoKey === 'ORIGEM') {
      return {
        retiradaCheio: ['ricPorto', 'RIC PORTO'],
        diarioBordo: ['diarioBordo', 'DIARIO DE BORDO'],
        devolucaoVazio: ['ricDepot', 'RIC DEPOT']
      };
    }

    return {
      retiradaCheio: ['ricPortoDestino', 'RIC PORTO DESTINO'],
      devolucaoVazio: ['ricDepotDestino', 'RIC DEPOT DESTINO'],
      canhotCTE: ['comprovanteDesova', 'COMPROVANTE DE DESOVA'],
      diarioBordo: ['diarioBordo', 'DIARIO DE BORDO'],
      canhotNF: ['canhotoDanfe', 'CANHOTO DE DANFE']
    };
  };

  const isIcompanyDocumentPresent = (record, fields = []) => {
    if (!record) return false;
    return fields.some((field) => {
      const value = record[field];
      if (value === true) return true;
      if (typeof value === 'number') return value > 0;
      if (value instanceof Date) return true;
      if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return false;
        const numeric = Number(text.replace(',', '.'));
        if (!Number.isNaN(numeric)) return numeric > 0;
        return !['NAO', 'NÃO', 'NO', 'FALSE', 'X', '0'].includes(text.toUpperCase());
      }
      return Boolean(value);
    });
  };

  const linkedIcompanyRecord = icompanyRemoteRecord || findIcompanyInCache(selectedDelivery) || null;

  const parseObservationSections = () => {
    const currentIcompanyObservation = String(
      linkedIcompanyRecord?.observacao || linkedIcompanyRecord?.observacoes || ''
    ).trim();
    const raw = [selectedDelivery.observations, selectedDelivery.observacoes]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n');

    const sections = { icompany: currentIcompanyObservation, operation: [] };
    if (!raw) return sections;

    const marker = 'Observação Icompany:';
    const lines = raw.split(/\r?\n/);
    let current = raw.includes(marker) ? null : 'operation';

    lines.forEach((line) => {
      const text = line.trim();
      if (!text) return;

      if (text.startsWith(marker)) {
        current = 'icompany';
        sections.icompany = text.slice(marker.length).trim();
        return;
      }

      const startsOperationNote =
        text.startsWith('Criada a partir') ||
        text.startsWith('Montagem finalizada') ||
        text.startsWith('[') ||
        text.startsWith('(');

      if (current === 'icompany' && !startsOperationNote) {
        sections.icompany = sections.icompany ? `${sections.icompany}\n${text}` : text;
        return;
      }

      current = 'operation';
      sections.operation.push(text);
    });

    if (currentIcompanyObservation) {
      sections.icompany = currentIcompanyObservation;
    }

    return sections;
  };

  const formatObservationEntry = (entry) => {
    const match = String(entry || '').match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!match) return { time: null, text: entry };
    return { time: match[1], text: match[2] || entry };
  };

  const observationSections = parseObservationSections();
  const hasObservations =
    Boolean(observationSections.icompany) ||
    observationSections.operation.length > 0 ||
    Boolean(selectedDelivery.documentsJustification) ||
    Boolean(selectedDelivery.submissionObservation) ||
    (selectedDelivery.documentCorrectionLog && selectedDelivery.documentCorrectionLog.length > 0);
  const containerNumber = Array.isArray(selectedDelivery.containerNumero)
    ? selectedDelivery.containerNumero.filter(Boolean).join(', ')
    : selectedDelivery.containerNumero || selectedDelivery.container || selectedDelivery.cntr || selectedDelivery.numeroContainer || '';
  const armador = selectedDelivery.armador || selectedDelivery.linkedProgramacaoId?.armador || '';
  const effectiveSentido = selectedDelivery.sentido || selectedSentido || 'DESTINO';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-[#1a1a2e] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        <div className="relative overflow-hidden px-5 sm:px-6 py-3.5 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.32),transparent_34%),linear-gradient(135deg,rgba(88,28,135,0.95),rgba(49,46,129,0.92))] border-b border-white/10 flex-shrink-0">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
                <div className="min-w-0 flex items-end gap-2">
                  <p className="pb-0.5 text-[10px] text-purple-200/80 uppercase tracking-[0.2em] font-bold">Entrega</p>
                  <h2 className="text-2xl sm:text-[28px] font-black leading-none tracking-wide text-white">
                    #{selectedDelivery.deliveryNumber}
                  </h2>
                </div>
                <Badge
                  status={(selectedDelivery.status === 'FINALIZADO' && allModalDocsComplete(selectedDelivery)) ? 'DOCUMENTOS ENTREGUES' : selectedDelivery.status}
                  city={city}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {containerNumber && (
                  <div className="min-w-0 rounded-xl border border-white/20 bg-white/[0.075] px-3 py-2 shadow-inner shadow-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-cyan-300/15 text-cyan-100 flex items-center justify-center border border-cyan-200/20 flex-shrink-0">
                        <FaBoxOpen className="text-xs" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-cyan-100/70 leading-none mb-1">Container</p>
                        <p className="text-sm font-black text-white truncate leading-tight">{containerNumber}</p>
                      </div>
                    </div>
                  </div>
                )}
                {armador && (
                  <div className="min-w-0 rounded-xl border border-white/20 bg-white/[0.075] px-3 py-2 shadow-inner shadow-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-amber-300/15 text-amber-100 flex items-center justify-center border border-amber-200/20 flex-shrink-0">
                        <FaBuilding className="text-xs" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-amber-100/70 leading-none mb-1">Armador</p>
                        <p className="text-sm font-black text-white truncate leading-tight">{armador}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="sr-only">
                <p>CAB: {selectedDelivery.processoCAB || selectedDelivery.processo || selectedDelivery.processNumber || selectedDelivery.codigo || '-'}</p>
                <p>Codigo: {(linkedIcompanyRecord?.codigo || '-')}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Fechar modal"
              className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/10 flex-shrink-0"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
          {(() => {
            const effectiveRecord = linkedIcompanyRecord;
            const effectiveComparisons = compareWithIcompany(selectedDelivery, effectiveRecord);
            const hasNotFound = effectiveComparisons && effectiveComparisons.__notFound;
            const icompanyMatched = !hasNotFound && effectiveComparisons && Object.keys(effectiveComparisons).length > 0;

            let warning = null;
            if (hasNotFound) {
              warning = (
                <div className="rounded-xl p-3 bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 text-xs font-semibold">
                  ⚠️ {effectiveComparisons.mensagem || 'Registro Icompany não encontrado para esta entrega.'}
                </div>
              );
            } else if (icompanyLookupStatus === 'searching') {
              warning = (
                <div className="rounded-xl p-3 bg-blue-900/20 border border-blue-700/50 text-blue-200 text-xs font-semibold">
                  🔍 Buscando registro em Icompany...
                </div>
              );
            } else if (icompanyLookupStatus === 'error') {
              warning = (
                <div className="rounded-xl p-3 bg-red-900/20 border border-red-700/50 text-red-200 text-xs font-semibold">
                  ❌ Erro ao buscar registro em Icompany. Verifique o log no console.
                </div>
              );
            } else if (!icompanyMatched) {
              warning = (
                <div className="rounded-xl p-3 bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 text-xs font-semibold">
                  ⚠️ Registro Icompany não encontrado para o processo/ID desta entrega. A comparação só funciona quando há correspondência exata em Icompany (campo código/processo/numero).
                </div>
              );
            }

            return (
              <>
                {warning}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {(() => {
                    const comparisons = effectiveComparisons;

              return [
                ['Contratado', selectedDelivery.userName],
                ['Motorista', selectedDelivery.driverName || '—'],
                ['Placa', selectedDelivery.placaIcompany || selectedDelivery.vehiclePlate || '—'],
                ['Entrega CNTR Porto', selectedDelivery.horarioDevolucaoVazio ? formatarData(selectedDelivery.horarioDevolucaoVazio, city) : '—'],
                [getPartyLabelBySentido(effectiveSentido), getPartyBySentido(selectedDelivery, effectiveSentido)],
                ['Agendamento', getProgramacaoDate(selectedDelivery, city) ? formatarAgendamento(getProgramacaoDate(selectedDelivery, city)) : '—'],
                ['Montagem Container', selectedDelivery.containerMontadoAt ? formatarData(selectedDelivery.containerMontadoAt, city) : '—'],
                ['Chegada', selectedDelivery.horarioChegada ? formatarData(selectedDelivery.horarioChegada, city) : '—'],
                [`Início ${getDesovaLabelBySentido(effectiveSentido)}`, selectedDelivery.horarioInicioDesova ? formatarData(selectedDelivery.horarioInicioDesova, city) : '—'],
                [`Fim ${getDesovaLabelBySentido(effectiveSentido)}`, selectedDelivery.horarioFimDesova ? formatarData(selectedDelivery.horarioFimDesova, city) : '—'],
                ['Saindo do Cliente', selectedDelivery.horarioSaidaCliente ? formatarData(selectedDelivery.horarioSaidaCliente, city) : '—'],
                ['Chegada no Porto', selectedDelivery.horarioChegadaPorto ? formatarData(selectedDelivery.horarioChegadaPorto, city) : '—'],
              ].map(([label, value]) => {
                const comparison = comparisons[label];
                const isInconsistent = comparison?.isInconsistent;

                return (
                  <div key={label} className={`bg-white/5 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border ${isInconsistent ? 'border-red-500/50 bg-red-900/10' : 'border-white/5'}`}>
                    <p className={`text-[10px] uppercase tracking-widest font-semibold mb-0.5 ${isInconsistent ? 'text-red-400' : 'text-gray-500'}`}>
                      {label}
                      {isInconsistent && <span className="ml-1 text-red-400">⚠️</span>}
                    </p>
                    <p className={`text-sm font-semibold ${isInconsistent ? 'text-red-300' : 'text-gray-100'}`}>
                      {value}
                    </p>
                    {isInconsistent && (
                      <p className="text-[9px] text-red-400 mt-0.5 opacity-80">
                        Icompany: {comparison.displayIcompany}
                      </p>
                    )}
                  </div>
                );
              });
            })()}

            {/* Detectar inconsistências para o botão de verificação */}
            {(() => {
              const comparisons = effectiveComparisons;
              const temInconsistenciaData = Object.values(comparisons || {}).some(comp => comp?.isInconsistent === true);
              
              const labels = getLabelsBySentido(selectedDelivery, effectiveSentido);
              const docMap = getIcompanyDocumentMap(effectiveSentido);
              const temInconsistenciaDocumento = getDocumentKeysBySentido(effectiveSentido)
                .some((k) => {
                  const present = !!selectedDelivery.documents[k];
                  const icompanyFields = docMap[k] || [];
                  const icompanyPresent = isIcompanyDocumentPresent(effectiveRecord, icompanyFields);
                  return present && icompanyFields.length > 0 && !icompanyPresent;
                });

              const temInconsistencias = temInconsistenciaData || temInconsistenciaDocumento;

              // Só renderizar o botão se houver inconsistências
              if (!temInconsistencias) return null;

              return (
                <div className={`mt-4 pt-4 border-t border-white/10 p-4 rounded-xl transition-all duration-300 ${
                  icompanyVerified?.[selectedDelivery._id]?.verified
                    ? 'bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-l-4 border-l-emerald-500'
                    : 'bg-gradient-to-r from-emerald-900/15 to-teal-900/15 hover:from-emerald-900/20 hover:to-teal-900/20'
                }`}>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={icompanyVerified?.[selectedDelivery._id]?.verified || false}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          try {
                            const verification = await updateVerificationWithServer(selectedDelivery._id, true, '');
                            const newState = {
                              ...icompanyVerified,
                              [selectedDelivery._id]: {
                                verified: true,
                                verifiedAt: verification.verifiedAt,
                                verifiedBy: verification.verifiedBy || userName
                              }
                            };
                            setIcompanyVerified(newState);
                            localStorage.setItem('icompanyVerified', JSON.stringify(newState));
                            localStorage.setItem('icompanyVerifiedRefresh', Date.now().toString());
                            setToast({
                              type: 'success',
                              message: `✓ Inconsistências verificadas`,
                              duration: 3000
                            });
                          } catch (err) {
                            e.target.checked = false;
                          }
                        } else {
                          setDeliveryToUnverify(selectedDelivery._id);
                          setConfirmRemoveVerification(true);
                        }
                      }}
                      className="sr-only"
                      id={`verification-checkbox-${selectedDelivery._id}`}
                    />
                    <div 
                      className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                        icompanyVerified?.[selectedDelivery._id]?.verified
                          ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/50'
                          : 'border-emerald-400/50 group-hover:border-emerald-400'
                      }`}>
                      {icompanyVerified?.[selectedDelivery._id]?.verified && (
                        <FaCheckCircle className="text-white text-xs" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold transition-colors ${
                        icompanyVerified?.[selectedDelivery._id]?.verified
                          ? 'text-emerald-200'
                          : 'text-emerald-300 group-hover:text-emerald-200'
                      }`}>
                        ✓ Inconsistências Verificadas
                      </span>
                      <span className={`text-xs transition-colors ${
                        icompanyVerified?.[selectedDelivery._id]?.verified
                          ? 'text-emerald-300/80'
                          : 'text-emerald-400/70 group-hover:text-emerald-300/70'
                      }`}>
                        {icompanyVerified?.[selectedDelivery._id]?.verified
                          ? `Verificado por ${icompanyVerified[selectedDelivery._id]?.verifiedBy || 'Usuário'}`
                          : 'Marque para confirmar que as inconsistências foram verificadas'}
                      </span>
                    </div>
                  </label>
                </div>
              );
            })()}
              </div>
            </>
          );
          })()}

          {flowHistory.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">📍 Histórico do Fluxo</p>
              <div className="space-y-2">
                {flowHistory.map((ev, idx) => {
                  let duration = null;
                  if (idx < flowHistory.length - 1) {
                    const nextDate = new Date(flowHistory[idx + 1].date);
                    const currentDate = new Date(ev.date);
                    const diffMs = nextDate - currentDate;
                    if (diffMs > 0) {
                      const totalMin = Math.floor(diffMs / 60000);
                      const h = Math.floor(totalMin / 60);
                      const m = totalMin % 60;
                      duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
                    }
                  } else {
                    const isFinished = normalizeKey(selectedDelivery.status) === 'FINALIZADO' || selectedDelivery.status === 'ENTREGUE' || selectedDelivery.status === 'submitted' || selectedDelivery.status === 'DOCUMENTOS ENTREGUES';
                    if (!isFinished) {
                      const currentDate = new Date(ev.date);
                      const now = currentTime;
                      const diffMs = now - currentDate;
                      if (diffMs > 0) {
                        const totalMin = Math.floor(diffMs / 60000);
                        const h = Math.floor(totalMin / 60);
                        const m = totalMin % 60;
                        duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
                      }
                    }
                  }
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                      <span className="text-sm text-gray-200 flex-1">{ev.label}</span>
                      <span className="text-xs text-gray-500 font-mono">{new Date(ev.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {duration && <span className="text-xs text-gray-500 font-mono">Tempo no status: {duration}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasObservations && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 shadow-xl">
              <div className="px-4 py-3 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-blue-300">
                    <FaFileAlt size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-blue-300 uppercase tracking-widest font-black">Observações</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300 font-bold uppercase tracking-wide">
                  Registro
                </span>
              </div>

              <div className="p-4 space-y-3">
                {observationSections.icompany && (
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-cyan-400/10 flex items-center gap-2">
                      <FaBuilding className="text-cyan-300" size={13} />
                      <div>
                        <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-black">Observação Icompany</p>
                      </div>
                    </div>
                    <p className="px-4 py-3 text-sm leading-relaxed text-gray-100 whitespace-pre-wrap break-words">
                      {observationSections.icompany}
                    </p>
                  </div>
                )}

                {observationSections.operation.length > 0 && (
                  <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-violet-400/10 flex items-center gap-2">
                      <FaUser className="text-violet-300" size={13} />
                      <div>
                        <p className="text-[10px] text-violet-300 uppercase tracking-widest font-black">Operação</p>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      {observationSections.operation.map((entry, idx) => {
                        const formatted = formatObservationEntry(entry);
                        return (
                          <div key={idx} className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2.5">
                            {formatted.time && (
                              <p className="text-[10px] text-violet-200/70 font-mono mb-1">
                                {formatted.time}
                              </p>
                            )}
                            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                              {formatted.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {selectedDelivery.documentsJustification && (
                <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4">
                  <p className="text-[10px] text-amber-300 uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                    <FaExclamationTriangle size={12} /> Justificativa de Documentos
                  </p>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{selectedDelivery.documentsJustification}</p>
                </div>
              )}
              {selectedDelivery.documentCorrectionLog && selectedDelivery.documentCorrectionLog.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-400/20 rounded-xl p-4">
                  <p className="text-[10px] text-rose-300 uppercase tracking-widest font-black mb-2">Correções de Documentos</p>
                  <div className="space-y-2 text-sm text-gray-300">
                    {selectedDelivery.documentCorrectionLog.slice(-3).map((entry, idx) => (
                      <div key={idx} className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <p className="font-semibold text-sm text-white">{getDocumentLabel(entry.documentType, city)}</p>
                        <p className="text-xs text-gray-300">{entry.reason}</p>
                        <p className="text-[10px] text-gray-400 mt-1">Removido por {entry.removedBy || entry.role} em {new Date(entry.removedAt).toLocaleString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDelivery.submissionObservation && (
                <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-4">
                  <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-black mb-2">Observação de Canhoto Retido</p>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{selectedDelivery.submissionObservation}</p>
                </div>
              )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Documentos e Fotos</p>
              <div className="flex gap-2">
                <button
                  onClick={handleShareDelivery}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-emerald-200 text-xs font-semibold rounded-lg transition border border-emerald-500/20"
                >
                  <FaShareAlt /> <span className="hidden sm:inline">Gerar Comprovante de Entrega</span>
                </button>

                <button
                  onClick={() => handleDownloadAll(selectedDelivery._id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-200 text-xs font-semibold rounded-lg transition border border-blue-500/20"
                >
                  <FaDownload /> <span className="hidden sm:inline">Baixar Tudo</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {controleProtocolosLookupStatus === 'searching' && (
                <div className="rounded-xl p-3 bg-blue-900/20 border border-blue-700/50 text-blue-200 text-xs font-semibold">
                  🔍 Buscando protocolo no Controle de Protocolos por processo/código...
                </div>
              )}
              {controleProtocolosLookupStatus === 'notfound' && (
                <div className="rounded-xl p-3 bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 text-xs font-semibold">
                  ⚠️ Nenhum protocolo encontrado no Controle de Protocolos para o código/processo exibido no modal.
                </div>
              )}
              {controleProtocolosLookupStatus === 'error' && (
                <div className="rounded-xl p-3 bg-red-900/20 border border-red-700/50 text-red-200 text-xs font-semibold">
                  ❌ Erro ao buscar protocolo no Controle de Protocolos. Verifique o console.
                </div>
              )}

              {(() => {
                const labels = getLabelsBySentido(selectedDelivery, effectiveSentido);
                const docMap = getIcompanyDocumentMap(effectiveSentido);

                const hiddenPhotoKeys = ['chegadaCliente', 'inicioDesova', 'fimDesova', 'saidaCliente', 'chegadaPorto'];
                const expectedDocKeys = getDocumentKeysBySentido(effectiveSentido);
                const extraDocKeys = Object.keys(selectedDelivery.documents || {})
                  .filter((k) => !hiddenPhotoKeys.includes(k) && !expectedDocKeys.includes(k));

                const docRows = [...expectedDocKeys, ...extraDocKeys]
                  .map((k) => {
                    const present = !!selectedDelivery.documents[k];
                    const canRemoveThisDocument = present && canRemoveDocument;
                    const icompanyFields = docMap[k] || [];
                    const icompanyPresent = isIcompanyDocumentPresent(linkedIcompanyRecord, icompanyFields);
                    const mismatch = present && icompanyFields.length > 0 && !icompanyPresent;

                    return (
                      <div
                        key={k}
                        className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl border ${mismatch ? 'bg-rose-900/10 border-rose-500/40' : present ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${present ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                          <span className={`text-sm font-semibold ${mismatch ? 'text-rose-300' : 'text-gray-300'}`}>{labels[k] || k}</span>
                          {!present && <span className="text-xs text-gray-600">Não anexado</span>}
                          {mismatch && <span className="text-xs text-rose-200">Presente no GeoTower, ausente no Icompany</span>}
                        </div>

                        {present && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingDocument({ label: labels[k] || k, urls: getDocumentUrlsArray(selectedDelivery.documents[k]) })}
                              className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 flex items-center justify-center transition"
                            >
                              <FaEye size={11} />
                            </button>

                            <button
                              onClick={() => handleDownload(selectedDelivery._id, k, labels[k] || k)}
                              className="w-7 h-7 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 flex items-center justify-center transition"
                            >
                              <FaDownload size={11} />
                            </button>

                            {canRemoveThisDocument && (
                              <button
                                onClick={() => onRemoveDocument(selectedDelivery._id, k)}
                                className="w-7 h-7 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 flex items-center justify-center transition"
                                title="Remover documento inválido e marcar pendência"
                              >
                                <FaTrash size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });

                const fotoFields = [
                  { key: 'chegadaCliente', label: 'Chegada no Cliente' },
                  { key: 'inicioDesova', label: `Início da ${getDesovaLabelBySentido(effectiveSentido)}` },
                  { key: 'fimDesova', label: `Finalização da ${getDesovaLabelBySentido(effectiveSentido)}` },
                  { key: 'saidaCliente', label: 'Saída do Cliente' },
                  { key: 'chegadaPorto', label: 'Chegada no Porto' }
                ];

                const fotosRows = fotoFields.map((f) => {
                  const files = getDocumentUrlsArray(selectedDelivery.documents?.[f.key]);
                  const present = files.length > 0;
                  return (
                    <div
                      key={f.key}
                      className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl border ${present ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${present ? 'bg-sky-400' : 'bg-gray-600'}`} />
                        <span className="text-sm text-gray-300 font-semibold">{f.label}</span>
                        {present && <span className="text-xs text-gray-500">{files.length} foto(s)</span>}
                        {!present && <span className="text-xs text-gray-600">Não anexado</span>}
                      </div>

                      {present && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setModalFotos({ label: f.label, files })}
                            className="w-7 h-7 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 flex items-center justify-center transition"
                          >
                            <FaEye size={11} />
                          </button>

                          <button
                            onClick={() => files.forEach((url, i) => {
                              const a = document.createElement('a');
                              a.href = url;
                              a.setAttribute('download', `${f.label.replace(/\s+/g, '_')}_${i + 1}.jpg`);
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            })}
                            className="w-7 h-7 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 flex items-center justify-center transition"
                          >
                            <FaDownload size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });

                return [...docRows, ...fotosRows];
              })()}
            </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryModal;
