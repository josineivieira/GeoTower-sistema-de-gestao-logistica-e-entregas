import React, { useEffect, useState } from 'react';
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
} from 'react-icons/fa';
import { MdPendingActions } from 'react-icons/md';
import { adminService, deliveryService } from '../services/authService';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { getRecebedorLabel } from '../utils/cityLabels';
import { getDocumentLabel } from '../utils/documentLabels';

/* ─── Skeleton Loader ─────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 animate-pulse">
    <div className="flex justify-between items-start gap-4">
      <div className="flex-1 space-y-3">
        <div className="h-3 w-24 bg-gray-200 rounded-full" />
        <div className="h-6 w-44 bg-gray-300 rounded-full" />
        <div className="space-y-2">
          <div className="h-3 w-32 bg-gray-200 rounded-full" />
          <div className="h-3 w-28 bg-gray-200 rounded-full" />
        </div>
        <div className="flex gap-2 mt-2">
          <div className="h-6 w-24 bg-amber-100 rounded-full" />
          <div className="h-6 w-28 bg-amber-100 rounded-full" />
        </div>
      </div>
      <div className="h-12 w-28 bg-gray-200 rounded-2xl" />
    </div>
  </div>
);

/* ─── Badge de documento pendente ─────────────────────────── */
const DocBadge = ({ label }) => (
  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] rounded-full font-bold tracking-wide shadow-sm">
    <FaExclamationTriangle size={9} className="text-amber-500" />
    {label}
  </span>
);

/* ─── Info Row ─────────────────────────────────────────────── */
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

/* ─── Upload Field ─────────────────────────────────────────── */
/* Adiciona suporte para câmera e seleção de arquivos */
const UploadField = ({ doc, label, file, onChange }) => {
  const hasFile = file && file.length > 0;
  const fileInputRef = React.useRef(null);
  const cameraInputRef = React.useRef(null);

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const existingFiles = file ? Array.from(file) : [];
      const allFiles = [...existingFiles, ...newFiles];
      const dataTransfer = new DataTransfer();
      allFiles.forEach(f => dataTransfer.items.add(f));
      onChange({ target: { files: dataTransfer.files } });
    }
  };

  return (
    <div
      className={`relative rounded-3xl border-2 border-dashed transition-all duration-200 overflow-hidden ${
        hasFile
          ? 'border-emerald-400 bg-emerald-50'
          : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40'
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-2 p-5">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
            hasFile
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {hasFile ? <FaCheckCircle size={20} /> : <FaUpload size={18} />}
        </div>

        <div className="text-center">
          <p
            className={`text-sm font-extrabold capitalize ${
              hasFile ? 'text-emerald-700' : 'text-gray-700'
            }`}
          >
            {label || doc}
          </p>
          <p
            className={`text-xs mt-1 ${
              hasFile ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            {hasFile
              ? `${file.length} arquivo(s) selecionado(s)`
              : 'Selecione arquivo ou tire uma foto'}
          </p>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-xs font-bold active:scale-95 transition"
          >
            <FaUpload size={11} />
            Arquivo
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-xs font-bold active:scale-95 transition"
          >
            📷
            Câmera
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
};

/* ─── Main Component ───────────────────────────────────────── */
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
          p => String(p.contratado).trim().toUpperCase() === nomeFiltro
        );
      }

      const pendentes = (allProgramacoes || []).filter(
        p => Array.isArray(p.missingDocumentsAtSubmit) && p.missingDocumentsAtSubmit.length > 0
      );

      setItems(pendentes);
    } catch (err) {
      console.error('Erro ao carregar pendentes:', err);
      setItems([]);
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

  const handlePendingSubmit = async () => {
    if (!modalProgramacao) return;

    const missing = modalPendingDocs.filter(
      d => !modalUploadFiles[d] || modalUploadFiles[d].length === 0
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
        (modalProgramacao.container?.trim()) ||
        (modalProgramacao.processo?.trim());

      let deliveryId = modalProgramacao.linkedDeliveryId;

      if (!deliveryId && deliveryNumber) {
        const resp = await deliveryService.getMyDeliveries({ searchTerm: deliveryNumber });
        const found = resp.data.deliveries?.[0];
        if (found) deliveryId = found._id;
      }

      if (!deliveryId) throw new Error('Entrega não encontrada');

      for (const docType of modalPendingDocs) {
        const f = modalUploadFiles[docType];
        if (f?.length > 0) {
          await deliveryService.uploadDocument(deliveryId, docType, f);
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

  const allFilesSelected =
    modalPendingDocs.length > 0 &&
    modalPendingDocs.every(d => modalUploadFiles[d]?.length > 0);

  const progress =
    modalPendingDocs.length > 0
      ? (modalPendingDocs.filter(d => modalUploadFiles[d]?.length > 0).length / modalPendingDocs.length) * 100
      : 0;

  const totalDocsPendentes = items.reduce(
    (acc, item) => acc + (item.missingDocumentsAtSubmit?.length || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40">
      {/* ── HEADER ───────────────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition active:scale-95 shrink-0"
            >
              <FaChevronLeft size={14} />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
              <MdPendingActions className="text-white" size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black text-gray-800 leading-none truncate">
                Canhotos Pendentes
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Documentos aguardando envio
              </p>
            </div>
          </div>

          {!loading && (
            <div className="grid grid-cols-2 gap-3 mt-4">
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

      {/* ── CONTENT ──────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-5 pb-28">
        {!loading && items.length > 0 && (
          <div className="flex items-start gap-3 p-4 mb-4 bg-amber-50 border border-amber-200 rounded-3xl shadow-sm">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <FaExclamationTriangle size={15} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-800">Ação necessária</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                As entregas abaixo possuem documentos que não foram enviados na finalização.
                Anexe os arquivos faltantes para concluir o processo.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-5 shadow-inner">
              <FaClipboardCheck size={36} className="text-emerald-500" />
            </div>

            <h3 className="text-xl font-black text-gray-800 mb-2">Tudo em dia!</h3>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              Você não possui entregas com canhotos ou documentos pendentes no momento.
            </p>

            <button
              onClick={() => navigate('/home')}
              className="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition"
            >
              Voltar ao início
            </button>
          </div>
        )}

        {!loading && items.map((p, idx) => {
          const pendingDocs = p.missingDocumentsAtSubmit || [];

          return (
            <div
              key={p._id}
              className="bg-white rounded-[28px] shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-400" />

              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center shrink-0 shadow-inner">
                    <FaShip size={18} className="text-slate-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
                        Processo
                      </p>
                      <p className="text-lg font-black text-gray-800 leading-tight break-words">
                        {p.processo || p.container || '—'}
                      </p>
                    </div>

                    <div className="space-y-3 mt-4">
                      <InfoRow icon={FaBoxOpen} label="Container" value={p.container} />
                      <InfoRow icon={FaUser} label={getRecebedorLabel(city)} value={p.recebedor} />
                      <InfoRow icon={FaHashtag} label="Contratado" value={p.contratado} />
                    </div>

                    {pendingDocs.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-2">
                          Faltando
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {pendingDocs.map(d => (
                            <DocBadge key={d} label={getDocumentLabel(d, city)} />
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => openPendingModal(p)}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 transition-all duration-150 font-black text-sm"
                    >
                      <FaUpload size={15} />
                      Anexar documentos
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-2xl border border-amber-100">
                  <FaExclamationTriangle size={11} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-700 font-semibold">
                    {pendingDocs.length} documento{pendingDocs.length > 1 ? 's' : ''} aguardando envio
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL ────────────────────────────────────────────── */}
      {showUploadModal && modalProgramacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closePendingModal}
          />

          <div className="relative bg-white w-full h-[92vh] sm:h-auto sm:max-h-[90vh] sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header do modal */}
            <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-5 py-5 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-inner shrink-0">
                    <FaFileAlt className="text-white" size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-white text-lg font-black leading-tight">
                      Documentos Pendentes
                    </h2>
                    <p className="text-white/80 text-xs mt-1 font-medium break-words">
                      {modalProgramacao.processo || modalProgramacao.container}
                    </p>
                  </div>
                </div>

                <button
                  onClick={closePendingModal}
                  className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition shrink-0"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-white/75 text-xs font-medium">Progresso dos anexos</span>
                  <span className="text-white text-xs font-bold">
                    {modalPendingDocs.filter(d => modalUploadFiles[d]?.length > 0).length}
                    /{modalPendingDocs.length}
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

            {/* Body do modal */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/60 space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-sm font-bold text-blue-900">Como anexar</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Selecione os arquivos correspondentes a cada documento listado abaixo.
                  Todos devem ser preenchidos antes de confirmar.
                </p>
              </div>

              <div className="space-y-3">
                {modalPendingDocs.map(doc => (
                  <UploadField
                    key={doc}
                    doc={doc}
                    label={getDocumentLabel(doc, city)}
                    file={modalUploadFiles[doc]}
                    onChange={e => {
                      if (e.target.files) {
                        setModalUploadFiles(prev => ({
                          ...prev,
                          [doc]: Array.from(e.target.files),
                        }));
                      }
                    }}
                  />
                ))}
              </div>

              {modalSubmitting && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
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
                    <p className="text-emerald-700 font-bold text-sm">Enviando documentos...</p>
                    <p className="text-emerald-600 text-xs">Aguarde, isso pode levar alguns segundos.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div className="p-4 border-t border-gray-100 bg-white shrink-0 space-y-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              {!allFilesSelected && !modalSubmitting && (
                <p className="text-center text-xs text-gray-400 font-medium">
                  Selecione todos os arquivos para habilitar o envio
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={closePendingModal}
                  disabled={modalSubmitting}
                  className="py-3.5 bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm active:scale-95 transition disabled:opacity-40"
                >
                  Cancelar
                </button>

                <button
                  onClick={handlePendingSubmit}
                  disabled={modalSubmitting || !allFilesSelected}
                  className={`py-3.5 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all duration-200 ${
                    allFilesSelected && !modalSubmitting
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200 hover:shadow-emerald-300'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
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
