import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Toast from '../components/Toast';
import {
  FaTimes,
  FaFileAlt,
  FaChevronLeft,
  FaBoxOpen,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaUpload,
  FaCheckCircle,
  FaShip,
  FaHashtag,
  FaUser,
  FaCamera,
  FaFilePdf,
  FaTrashAlt,
  FaFolderOpen,
  FaArrowRight,
} from 'react-icons/fa';
import { MdPendingActions } from 'react-icons/md';
import { adminService, deliveryService } from '../services/authService';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { getRecebedorLabel } from '../utils/cityLabels';

/* ───────────────── Helpers ───────────────── */
const mergeFiles = (current = [], incomingList) => {
  const incoming = Array.from(incomingList || []);
  if (!incoming.length) return current;

  const map = new Map();

  [...current, ...incoming].forEach((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!map.has(key)) map.set(key, file);
  });

  return Array.from(map.values());
};

const getFileIcon = (file) => {
  if (file?.type?.includes('pdf')) return <FaFilePdf size={14} className="text-red-500" />;
  return <FaFileAlt size={14} className="text-emerald-600" />;
};

const truncateName = (name = '', max = 28) =>
  name.length > max ? `${name.slice(0, max)}...` : name;

/* ───────────────── Skeleton Loader ───────────────── */
const SkeletonCard = () => (
  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 animate-pulse">
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-gray-200 rounded-full" />
        <div className="h-8 w-24 bg-gray-200 rounded-2xl" />
      </div>
      <div className="h-6 w-44 bg-gray-300 rounded-full" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-gray-100 rounded-full" />
        <div className="h-4 w-5/6 bg-gray-100 rounded-full" />
        <div className="h-4 w-3/4 bg-gray-100 rounded-full" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-7 w-24 bg-amber-100 rounded-full" />
        <div className="h-7 w-28 bg-amber-100 rounded-full" />
      </div>
    </div>
  </div>
);

/* ───────────────── Badges ───────────────── */
const DocBadge = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] rounded-full font-bold tracking-wide shadow-sm">
    <FaExclamationTriangle size={9} className="text-amber-500" />
    {label}
  </span>
);

const StatusPill = ({ total }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200">
    <MdPendingActions className="text-amber-600" size={14} />
    <span className="text-[11px] font-extrabold text-amber-700">
      {total} pendente{total > 1 ? 's' : ''}
    </span>
  </div>
);

/* ───────────────── Info Row ───────────────── */
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2.5 text-sm">
    <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
      <Icon size={12} className="text-gray-500" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">{label}</p>
      <p className="text-sm text-gray-700 font-semibold break-words">{value || '—'}</p>
    </div>
  </div>
);

/* ───────────────── File List ───────────────── */
const FileChip = ({ file, onRemove }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-200 px-3 py-2.5 shadow-sm">
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
        {getFileIcon(file)}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-700 truncate">{truncateName(file.name, 30)}</p>
        <p className="text-[11px] text-gray-400">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={onRemove}
      className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 active:scale-95 transition shrink-0"
    >
      <FaTrashAlt size={12} />
    </button>
  </div>
);

/* ───────────────── Upload Field ───────────────── */
const UploadField = ({ doc, files = [], onAddFiles, onRemoveFile }) => {
  const hasFiles = files.length > 0;

  return (
    <div
      className={`rounded-3xl border p-4 transition-all duration-200 ${
        hasFiles
          ? 'bg-emerald-50 border-emerald-200 shadow-sm'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-800 capitalize">{doc}</p>
          <p className={`text-xs mt-1 ${hasFiles ? 'text-emerald-700' : 'text-gray-400'}`}>
            {hasFiles
              ? `${files.length} arquivo(s) anexado(s)`
              : 'Anexe por foto da câmera ou arquivos do celular'}
          </p>
        </div>

        {hasFiles && (
          <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <FaCheckCircle size={18} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Tirar foto */}
        <label className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-100 active:scale-[0.98] transition cursor-pointer">
          <FaCamera size={15} />
          Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onAddFiles(doc, e.target.files);
                e.target.value = '';
              }
            }}
          />
        </label>

        {/* Escolher arquivo */}
        <label className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-gray-100 text-gray-700 font-bold text-sm border border-gray-200 active:scale-[0.98] transition cursor-pointer">
          <FaFolderOpen size={15} />
          Escolher arquivo / PDF
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onAddFiles(doc, e.target.files);
                e.target.value = '';
              }
            }}
          />
        </label>
      </div>

      {hasFiles && (
        <div className="mt-3 space-y-2">
          {files.map((file, index) => (
            <FileChip
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              file={file}
              onRemove={() => onRemoveFile(doc, index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ───────────────── Main Component ───────────────── */
const EntregasCanhotosPendentes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { city } = useCity();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalProgramacao, setModalProgramacao] = useState(null);
  const [modalPendingDocs, setModalPendingDocs] = useState([]);
  const [modalUploadFiles, setModalUploadFiles] = useState({});
  const [modalSubmitting, setModalSubmitting] = useState(false);

  useEffect(() => {
    loadPendentes();

    if (location.state?.toast) {
      setToast(location.state.toast);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.state]);

  const totalDocsPendentes = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + (Array.isArray(item.missingDocumentsAtSubmit) ? item.missingDocumentsAtSubmit.length : 0),
      0
    );
  }, [items]);

  const loadPendentes = async () => {
    setLoading(true);
    try {
      let allProgramacoes = [];

      try {
        const res = await deliveryService.getProgramacoesAssigned();
        allProgramacoes = res.data.programacoes || [];
      } catch (err) {
        console.warn('Falha em getProgramacoesAssigned, usando fallback adminService:', err && err.message);
        const res = await adminService.getProgramacoes();
        const todas = res.data.programacoes || [];
        const nomeFiltro = (user?.username || user?.name || '').trim().toUpperCase();
        allProgramacoes = todas.filter(
          (p) => String(p.contratado).trim().toUpperCase() === nomeFiltro
        );
      }

      const pendentes = (allProgramacoes || []).filter(
        (p) => Array.isArray(p.missingDocumentsAtSubmit) && p.missingDocumentsAtSubmit.length > 0
      );

      setItems(pendentes);
    } catch (err) {
      console.error('Erro ao carregar pendentes:', err);
      setItems([]);
      setToast({
        message: 'Não foi possível carregar os documentos pendentes.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const openPendingModal = (p) => {
    setModalProgramacao(p);
    setModalPendingDocs(p.missingDocumentsAtSubmit || []);
    setModalUploadFiles({});
    setShowUploadModal(true);
  };

  const closePendingModal = () => {
    if (modalSubmitting) return;
    setShowUploadModal(false);
    setModalProgramacao(null);
    setModalPendingDocs([]);
    setModalUploadFiles({});
  };

  const handleAddFiles = (doc, fileList) => {
    setModalUploadFiles((prev) => ({
      ...prev,
      [doc]: mergeFiles(prev[doc] || [], fileList),
    }));
  };

  const handleRemoveFile = (doc, indexToRemove) => {
    setModalUploadFiles((prev) => ({
      ...prev,
      [doc]: (prev[doc] || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const handlePendingSubmit = async () => {
    if (!modalProgramacao) return;

    const missing = modalPendingDocs.filter(
      (d) => !modalUploadFiles[d] || modalUploadFiles[d].length === 0
    );

    if (missing.length > 0) {
      setToast({
        message: 'Anexe todos os documentos faltantes antes de confirmar.',
        type: 'error',
      });
      return;
    }

    setModalSubmitting(true);

    try {
      const deliveryNumber =
        modalProgramacao.container?.trim() ||
        modalProgramacao.processo?.trim();

      let deliveryId = modalProgramacao.linkedDeliveryId;

      if (!deliveryId && deliveryNumber) {
        const resp = await deliveryService.getMyDeliveries({ searchTerm: deliveryNumber });
        const found = resp.data.deliveries?.[0];
        if (found) deliveryId = found._id;
      }

      if (!deliveryId) throw new Error('Entrega não encontrada');

      for (const docType of modalPendingDocs) {
        const files = modalUploadFiles[docType];
        if (files?.length > 0) {
          await deliveryService.uploadDocument(deliveryId, docType, files);
        }
      }

      await deliveryService.submitDelivery(deliveryId);

      await deliveryService.updateDelivery(deliveryId, {
        status: 'FINALIZADO',
        missingDocumentsAtSubmit: [],
      });

      try {
        await adminService.updateProgramacao(modalProgramacao._id, {
          status: 'FINALIZADO',
          missingDocumentsAtSubmit: [],
        });
      } catch (_) {}

      setToast({
        message: 'Documentos anexados e entrega finalizada com sucesso!',
        type: 'success',
      });

      closePendingModal();
      navigate('/minhas-entregas');
    } catch (err) {
      console.error(err);
      setToast({
        message: err.message || 'Erro ao anexar documentos',
        type: 'error',
      });
    } finally {
      setModalSubmitting(false);
      loadPendentes();
    }
  };

  const completedDocs = modalPendingDocs.filter((d) => modalUploadFiles[d]?.length > 0).length;

  const allFilesSelected =
    modalPendingDocs.length > 0 &&
    modalPendingDocs.every((d) => modalUploadFiles[d]?.length > 0);

  const progress =
    modalPendingDocs.length > 0
      ? (completedDocs / modalPendingDocs.length) * 100
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 active:scale-95 transition shrink-0"
            >
              <FaChevronLeft size={14} />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
              <MdPendingActions className="text-white" size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black text-gray-800 leading-tight">
                Canhotos pendentes
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Envie os documentos faltantes para concluir as entregas
              </p>
            </div>
          </div>

          {!loading && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white border border-gray-100 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                  Entregas
                </p>
                <p className="text-2xl font-black text-gray-800 mt-1">{items.length}</p>
                <p className="text-xs text-gray-400 mt-1">com pendência</p>
              </div>

              <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wider text-amber-600 font-bold">
                  Documentos
                </p>
                <p className="text-2xl font-black text-amber-700 mt-1">{totalDocsPendentes}</p>
                <p className="text-xs text-amber-600 mt-1">aguardando envio</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-4 py-5 pb-28">
        {!loading && items.length > 0 && (
          <div className="mb-4 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <FaExclamationTriangle size={16} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-800">Atenção motorista</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  As entregas abaixo foram finalizadas sem todos os documentos. Abra cada item,
                  anexe o que falta e confirme o envio.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-5 shadow-inner">
              <FaClipboardCheck size={36} className="text-emerald-500" />
            </div>

            <h3 className="text-xl font-black text-gray-800 mb-2">Tudo certo por aqui</h3>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              Você não possui entregas com documentos pendentes no momento.
            </p>

            <button
              onClick={() => navigate('/home')}
              className="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition"
            >
              Voltar ao início
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-4">
            {items.map((p, idx) => {
              const pendingDocs = p.missingDocumentsAtSubmit || [];

              return (
                <div
                  key={p._id}
                  className="bg-white rounded-[28px] shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                  style={{ animationDelay: `${idx * 70}ms` }}
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500" />

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center shrink-0 shadow-inner">
                        <FaShip size={18} className="text-slate-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-[0.18em] mb-1">
                              Processo
                            </p>
                            <p className="text-lg sm:text-xl font-black text-gray-800 leading-tight break-words">
                              {p.processo || p.container || '—'}
                            </p>
                          </div>

                          <StatusPill total={pendingDocs.length} />
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3">
                          <InfoRow icon={FaBoxOpen} label="Container" value={p.container} />
                          <InfoRow
                            icon={FaUser}
                            label={getRecebedorLabel(city)}
                            value={p.recebedor}
                          />
                          <InfoRow icon={FaHashtag} label="Contratado" value={p.contratado} />
                        </div>

                        {pendingDocs.length > 0 && (
                          <div className="mt-4">
                            <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-[0.18em] mb-2">
                              Documentos faltando
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {pendingDocs.map((d) => (
                                <DocBadge key={d} label={d} />
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => openPendingModal(p)}
                          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-100 hover:shadow-emerald-200 active:scale-[0.98] transition"
                        >
                          <FaUpload size={14} />
                          Anexar documentos
                          <FaArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL / SHEET */}
      {showUploadModal && modalProgramacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closePendingModal}
          />

          <div className="relative w-full h-[92vh] sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
            {/* mobile handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 bg-white">
              <div className="w-12 h-1.5 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-5 py-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner shrink-0">
                    <FaFileAlt className="text-white" size={20} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-white text-lg font-black leading-tight">
                      Enviar documentos
                    </h2>
                    <p className="text-white/80 text-xs mt-1 font-semibold break-words">
                      {modalProgramacao.processo || modalProgramacao.container}
                    </p>
                  </div>
                </div>

                <button
                  onClick={closePendingModal}
                  className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition shrink-0"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80 text-xs font-semibold">Progresso dos anexos</span>
                  <span className="text-white text-xs font-black">
                    {completedDocs}/{modalPendingDocs.length}
                  </span>
                </div>

                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50/60">
              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-sm font-bold text-blue-900">Como enviar</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Você pode <strong>tirar foto na hora</strong> ou <strong>escolher um arquivo/PDF</strong> do celular.
                  Todos os documentos abaixo precisam ser anexados.
                </p>
              </div>

              <div className="space-y-3">
                {modalPendingDocs.map((doc) => (
                  <UploadField
                    key={doc}
                    doc={doc}
                    files={modalUploadFiles[doc] || []}
                    onAddFiles={handleAddFiles}
                    onRemoveFile={handleRemoveFile}
                  />
                ))}
              </div>

              {modalSubmitting && (
                <div className="mt-4 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-3xl">
                  <svg
                    className="animate-spin h-5 w-5 text-emerald-500 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>

                  <div>
                    <p className="text-emerald-700 font-black text-sm">Enviando documentos...</p>
                    <p className="text-emerald-600 text-xs">
                      Aguarde alguns segundos enquanto processamos os anexos.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white shrink-0 space-y-3">
              {!allFilesSelected && !modalSubmitting && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-center text-xs text-amber-700 font-bold">
                    Falta anexar todos os documentos para liberar o envio
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={closePendingModal}
                  disabled={modalSubmitting}
                  className="py-3.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-2xl font-black text-sm active:scale-[0.98] transition disabled:opacity-40"
                >
                  Cancelar
                </button>

                <button
                  onClick={handlePendingSubmit}
                  disabled={modalSubmitting || !allFilesSelected}
                  className={`py-3.5 rounded-2xl font-black text-sm active:scale-[0.98] transition-all duration-200 ${
                    allFilesSelected && !modalSubmitting
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-100'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {modalSubmitting ? 'Enviando...' : 'Confirmar envio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
