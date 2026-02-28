import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Toast from '../components/Toast';
import { FaTimes, FaFileAlt } from 'react-icons/fa';
import { adminService, deliveryService } from '../services/authService';
import { useAuth } from '../services/authContext';

const EntregasCanhotosPendentes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
    // show toast if passed via navigation
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      // clear state so it doesn't persist on back/refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.state]);
  const loadPendentes = async () => {
    setLoading(true);
    try {
      const res = await adminService.getProgramacoes();
      const todas = res.data.programacoes || [];
      const nomeFiltro = (user?.username || user?.name || '').trim().toUpperCase();
      const minhas = todas.filter(p => String(p.contratado).trim().toUpperCase() === nomeFiltro);
      const pendentes = minhas.filter(p => String(p.status || '').toUpperCase() === 'ENTREGUE_COM_PENDENCIA_CANHOTO');
      setItems(pendentes);
    } catch (err) {
      console.error('Erro ao carregar pendentes:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openPendingModal = (p) => {
    const pendingDocs = p.missingDocumentsAtSubmit || [];
    setModalProgramacao(p);
    setModalPendingDocs(pendingDocs);
    setModalUploadFiles({});
    setShowUploadModal(true);
  };

  const closePendingModal = () => {
    setShowUploadModal(false);
    setModalProgramacao(null);
    setModalPendingDocs([]);
    setModalUploadFiles({});
  };

  const handlePendingSubmit = async () => {
    if (!modalProgramacao) return;
    const docs = modalPendingDocs;
    const files = modalUploadFiles;
    // require at least one file for each missing
    const missing = docs.filter(d => !files[d] || files[d].length === 0);
    if (missing.length > 0) {
      setToast({ message: 'Anexe todos os documentos faltantes', type: 'error' });
      return;
    }
    setModalSubmitting(true);
    try {
      // find delivery id
      const deliveryNumber = (modalProgramacao.container && modalProgramacao.container.trim()) || (modalProgramacao.processo && modalProgramacao.processo.trim());
      let deliveryId = modalProgramacao.linkedDeliveryId;
      if (!deliveryId && deliveryNumber) {
        const resp = await deliveryService.getMyDeliveries({ searchTerm: deliveryNumber });
        const found = resp.data.deliveries && resp.data.deliveries[0];
        if (found) deliveryId = found._id;
      }
      if (!deliveryId) throw new Error('Entrega não encontrada');
      // upload each
      for (const docType of docs) {
        const f = files[docType];
        if (f && f.length > 0) {
          await deliveryService.uploadDocument(deliveryId, docType, f);
        }
      }
      // finalize
      await deliveryService.updateDelivery(deliveryId, { status: 'FINALIZADO' });
      try { await adminService.updateProgramacao(modalProgramacao._id, { status: 'FINALIZADO' }); } catch(_){}
      setToast({ message: 'Documentos anexados, entrega finalizada!', type: 'success' });
      closePendingModal();
      navigate('/minhas-entregas');
    } catch (err) {
      console.error(err);
      setToast({ message: err.message || 'Erro ao anexar documentos', type: 'error' });
    } finally {
      setModalSubmitting(false);
      loadPendentes();
    }
  };

  const handleAnexar = async (p, pending) => {
    // navigate to programadas and request opening the flow at finalDocs with pending info
    let url = `/entregas-programadas?q=${encodeURIComponent(p.processo || p.container || '')}`;
    url += `&step=finalDocs`;
    if (pending) {
      url += `&pending=${encodeURIComponent(pending)}`;
    }
    navigate(url);
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <button onClick={() => navigate('/home')} className="text-sm text-purple-600 mb-4">← Voltar</button>
      <h2 className="text-2xl font-bold mb-4">Entregas com Canhotos Pendentes</h2>
      {loading ? (
        <div className="py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded p-6">Nenhuma entrega com canhotos pendentes.</div>
      ) : (
        <div className="space-y-4">
          {items.map(p => {
            const pendingDocs = p.missingDocumentsAtSubmit || [];
            const pending = pendingDocs.length > 0 ? pendingDocs[0] : '';
            return (
            <div key={p._id} className="bg-white rounded shadow p-4 flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-500">Processo</div>
                <div className="font-bold text-lg">{p.processo || p.container}</div>
                <div className="text-xs text-gray-600">Container: {p.container || '-'}</div>
                <div className="text-xs text-gray-600">Recebedor: {p.recebedor || '-'}</div>
                {pendingDocs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pendingDocs.map(d => (
                      <span key={d} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-semibold">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openPendingModal(p)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded"
                >
                  Anexar documentos
                </button>
              </div>
            </div>
          )})}
        </div>
      )}
      {/* MODAL: ANEXAR DOCUMENTOS PENDENTES */}
      {showUploadModal && modalProgramacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FaFileAlt className="text-white" size={18} />
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-extrabold">Anexar Documentos Faltantes</h2>
                    <p className="text-white/70 text-sm">{modalProgramacao.processo}</p>
                  </div>
                </div>
                <button onClick={closePendingModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-gray-600 text-sm">Anexe apenas os documentos que estão faltando abaixo.</p>
              <div className="space-y-3">
                {modalPendingDocs.map(doc => (
                  <div key={doc} className="flex flex-col gap-2">
                    <label className="text-sm font-semibold capitalize">{doc}</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={e => {
                        if (e.target.files) {
                          setModalUploadFiles(prev => ({ ...prev, [doc]: Array.from(e.target.files) }));
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
              {modalSubmitting && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl">
                  <svg className="animate-spin h-5 w-5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-emerald-700 font-semibold text-sm">Enviando...</span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handlePendingSubmit}
                  disabled={modalSubmitting}
                  className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-base shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirmar
                </button>
                <button
                  onClick={closePendingModal}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-base active:scale-95 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default EntregasCanhotosPendentes;
