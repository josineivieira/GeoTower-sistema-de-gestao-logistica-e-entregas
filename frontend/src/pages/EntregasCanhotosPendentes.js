import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClipboardList,
  FaExclamationTriangle,
  FaSave,
  FaSearch,
  FaSync,
  FaTruck,
  FaUpload,
  FaUser,
} from 'react-icons/fa';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useCity } from '../contexts/CityContext';
import { getDocumentLabel } from '../utils/documentLabels';
import { formatarData } from '../utils/date';

const Field = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">{label}</p>
    <p className="text-sm font-semibold text-slate-700 break-words">{value || '-'}</p>
  </div>
);

const formatScheduleValue = (value, city) => {
  if (!value) return '-';
  const text = String(value).trim();
  if (!text) return '-';

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return formatarData(text, city, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getScheduleInfo = (item, city) => {
  const isItajai = city === 'itajai';
  const value = isItajai
    ? (item.dtColeta || item.dataAgendamento)
    : (item.dataAgendamento || item.dtColeta);

  return {
    label: isItajai && item.dtColeta ? 'Dt. coleta' : 'Agendamento',
    value: formatScheduleValue(value, city),
  };
};

const getPartyLabel = (item, city) => {
  const sentido = String(item?.sentido || '').trim().toUpperCase();
  if (sentido === 'ORIGEM') return 'Remetente';
  if (sentido === 'DESTINO') return 'Recebedor';
  return city === 'itajai' ? 'Remetente' : 'Recebedor';
};

const PendingDocumentControl = ({ doc, city, disabled, onUpload }) => {
  const inputId = `pending-doc-${doc}-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
      <div className="flex items-center gap-1.5 text-amber-700 text-[11px] font-black">
        <FaExclamationTriangle size={10} />
        {getDocumentLabel(doc, city)}
      </div>
      <div className="mt-2">
        <input
          id={inputId}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            onUpload(event.target.files);
            event.target.value = '';
          }}
        />
        <label
          htmlFor={inputId}
          className={`inline-flex items-center justify-center gap-1.5 w-full px-2.5 py-2 rounded-md text-[11px] font-black transition ${
            disabled
              ? 'bg-slate-200 text-slate-400 cursor-wait'
              : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer'
          }`}
        >
          <FaUpload size={10} />
          {disabled ? 'Anexando...' : 'Anexar'}
        </label>
      </div>
    </div>
  );
};

const EntregasCanhotosPendentes = () => {
  const navigate = useNavigate();
  const { city } = useCity();
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const loadPendencias = async () => {
    setLoading(true);
    try {
      const res = await adminService.getCanhotosPendentes();
      const deliveries = res.data?.deliveries || [];
      setItems(deliveries);
      setDrafts((prev) => {
        const next = {};
        deliveries.forEach((item) => {
          next[item._id] = prev[item._id] || {
            retornoGeoMar: '',
            retornoGeoLog: '',
          };
        });
        return next;
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao carregar canhotos pendentes',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [
      item.processoCAB,
      item.processoLog,
      item.deliveryNumber,
      item.container,
      item.userName,
      item.driverName,
      item.recebedor,
      item.retornoGeoMar,
      item.retornoGeoLog,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [items, search]);

  const totalDocs = items.reduce((sum, item) => (
    sum + (Array.isArray(item.missingDocumentsAtSubmit) ? item.missingDocumentsAtSubmit.length : 0)
  ), 0);

  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        retornoGeoMar: '',
        retornoGeoLog: '',
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  const saveRetornos = async (item) => {
    const draft = drafts[item._id] || {};
    if (!String(draft.retornoGeoMar || '').trim() && !String(draft.retornoGeoLog || '').trim()) {
      setToast({ type: 'warning', message: 'Digite uma nova observação antes de salvar' });
      return;
    }
    setSavingId(item._id);
    try {
      const res = await adminService.updateCanhotoRetornos(item._id, {
        retornoGeoMar: draft.retornoGeoMar || '',
        retornoGeoLog: draft.retornoGeoLog || '',
      });
      const updated = res.data?.delivery || {};
      setItems((prev) => prev.map((row) => (
        row._id === item._id
          ? {
              ...row,
              retornoGeoMar: updated.retornoGeoMar ?? draft.retornoGeoMar ?? '',
              retornoGeoLog: updated.retornoGeoLog ?? draft.retornoGeoLog ?? '',
              retornosPendenciaUpdatedAt: updated.retornosPendenciaUpdatedAt || new Date().toISOString(),
              retornosPendenciaUpdatedBy: updated.retornosPendenciaUpdatedBy || row.retornosPendenciaUpdatedBy,
            }
          : row
      )));
      setDrafts((prev) => ({
        ...prev,
        [item._id]: { retornoGeoMar: '', retornoGeoLog: '' },
      }));
      setToast({ type: 'success', message: 'Retornos salvos com sucesso' });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao salvar retornos',
      });
    } finally {
      setSavingId(null);
    }
  };

  const uploadDocumento = async (item, doc, files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    const uploadKey = `${item._id}:${doc}`;
    setUploadingDoc(uploadKey);
    try {
      const res = await adminService.uploadCanhotoDocumento(item._id, doc, selected);
      const updated = res.data?.delivery || {};
      const remaining = updated.missingDocumentsAtSubmit || [];

      setItems((prev) => {
        if (remaining.length === 0) return prev.filter((row) => row._id !== item._id);
        return prev.map((row) => (
          row._id === item._id
            ? {
                ...row,
                ...updated,
                missingDocumentsAtSubmit: remaining,
              }
            : row
        ));
      });

      setToast({
        type: 'success',
        message: remaining.length === 0
          ? 'Todos os documentos foram anexados. Entrega removida da pendência.'
          : `${getDocumentLabel(doc, city)} anexado com sucesso`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao anexar documento',
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/home')}
                className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                title="Voltar"
              >
                <FaArrowLeft />
              </button>
              <div className="w-11 h-11 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <FaClipboardList />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Canhotos Pendentes</h1>
                <p className="text-sm text-slate-500">Acompanhamento de entregas finalizadas com documentos faltantes</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar processo, motorista, retorno..."
                  className="w-full sm:w-80 pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <button
                onClick={loadPendencias}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition"
              >
                <FaSync size={12} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Entregas</p>
              <p className="text-2xl font-black text-slate-900">{items.length}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-amber-600 font-black">Documentos</p>
              <p className="text-2xl font-black text-amber-700">{totalDocs}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-black">Com retorno</p>
              <p className="text-2xl font-black text-emerald-700">
                {items.filter((item) => item.retornoGeoMar || item.retornoGeoLog).length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Cidade</p>
              <p className="text-2xl font-black text-slate-900 capitalize">{city}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-56 rounded-lg bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
            <FaCheckCircle className="mx-auto text-emerald-500 mb-3" size={34} />
            <h2 className="text-lg font-black text-slate-900">Nenhuma pendencia encontrada</h2>
            <p className="text-sm text-slate-500 mt-1">Nao ha entregas finalizadas com documentos faltantes para os filtros atuais.</p>
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const draft = drafts[item._id] || {};
              const pendingDocs = item.missingDocumentsAtSubmit || [];
              const isSaving = savingId === item._id;
              const scheduleInfo = getScheduleInfo(item, city);

              return (
                <div key={item._id} className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-l-4 border-amber-500 p-4 sm:p-5">
                    <div className="flex flex-col xl:flex-row gap-5">
                      <div className="xl:w-[42%] min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Processo</p>
                            <h2 className="text-xl font-black text-slate-900 break-words">
                              {item.processoCAB || item.deliveryNumber || '-'}
                            </h2>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black border border-amber-200">
                            {pendingDocs.length} pend.
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          <Field label="Container" value={Array.isArray(item.containerNumero) ? item.containerNumero.join(', ') : item.container || item.deliveryNumber} />
                          <Field label={scheduleInfo.label} value={scheduleInfo.value} />
                          <Field label="Contratado" value={item.userName} />
                          <Field label="Motorista" value={item.driverName} />
                          <Field label={getPartyLabel(item, city)} value={item.recebedor || item.destinatario || item.remetente} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                          {pendingDocs.map((doc) => (
                            <PendingDocumentControl
                              key={doc}
                              doc={doc}
                              city={city}
                              disabled={uploadingDoc === `${item._id}:${doc}`}
                              onUpload={(files) => uploadDocumento(item, doc, files)}
                            />
                          ))}
                        </div>

                        {(item.submissionObservation || item.documentsJustification) && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Justificativa do motorista</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {item.submissionObservation || item.documentsJustification}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="xl:flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <label className="block">
                          <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-500 font-black mb-2">
                            <FaUser size={11} />
                            Retorno GeoMar
                          </span>
                          {item.retornoGeoMar && (
                            <div className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap max-h-28 overflow-y-auto">
                              {item.retornoGeoMar}
                            </div>
                          )}
                          <textarea
                            value={draft.retornoGeoMar ?? ''}
                            onChange={(e) => updateDraft(item._id, 'retornoGeoMar', e.target.value)}
                            rows={4}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 resize-y"
                            placeholder="Adicionar nova observação da GeoMar..."
                          />
                        </label>

                        <label className="block">
                          <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-500 font-black mb-2">
                            <FaTruck size={11} />
                            Retorno GeoLog
                          </span>
                          {item.retornoGeoLog && (
                            <div className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap max-h-28 overflow-y-auto">
                              {item.retornoGeoLog}
                            </div>
                          )}
                          <textarea
                            value={draft.retornoGeoLog ?? ''}
                            onChange={(e) => updateDraft(item._id, 'retornoGeoLog', e.target.value)}
                            rows={4}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 resize-y"
                            placeholder="Adicionar nova observação da GeoLog..."
                          />
                        </label>

                        <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-slate-400">
                            {item.retornosPendenciaUpdatedAt ? (
                              <span>
                                Ultima atualizacao: {formatarData(item.retornosPendenciaUpdatedAt, city)}
                                {item.retornosPendenciaUpdatedBy ? ` por ${item.retornosPendenciaUpdatedBy}` : ''}
                              </span>
                            ) : (
                              <span>Nenhum retorno salvo ainda</span>
                            )}
                          </div>
                          <button
                            onClick={() => saveRetornos(item)}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition disabled:opacity-60"
                          >
                            <FaSave size={12} />
                            {isSaving ? 'Salvando...' : 'Salvar retornos'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default EntregasCanhotosPendentes;
