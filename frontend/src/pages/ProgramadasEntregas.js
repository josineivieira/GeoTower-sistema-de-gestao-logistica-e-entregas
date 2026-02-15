import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { deliveryService } from '../services/authService';
import { FaArrowLeft, FaCalendarAlt, FaSearch, FaCamera, FaTimes } from 'react-icons/fa';
import { useAuth } from '../services/authContext';

// Small elapsed timer component
const ElapsedTimer = ({ start }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let startDate = start ? new Date(start) : new Date();
    if (isNaN(startDate.getTime())) startDate = new Date();
    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span>{hh}:{mm}:{ss}</span>;
};

// Emoji truck progress component
const TruckEmoji = ({ progress = 0 }) => {
  // bar width 100%, truck moves along
  const left = `${Math.min(progress, 100)}%`;
  return (
    <div className="w-full h-8 bg-gray-200 rounded relative" style={{overflow: 'hidden'}}>
      <div className="absolute h-full flex items-center" style={{left}}>
        <span className="text-2xl">🚚</span>
      </div>
    </div>
  );
};

// Component to track truck progress based on elapsed time and render emoji bar
const ProgressiveTruck = ({ start }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let startDate = start ? new Date(start) : new Date();
    if (isNaN(startDate.getTime())) startDate = new Date();
    const tick = () => {
      const elapsed = Math.max(0, Date.now() - startDate.getTime());
      // 100% at 30 minutes
      const pct = Math.min(100, (elapsed / 1800000) * 100);
      setProgress(pct);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [start]);
  return <TruckEmoji progress={progress} />;
};


// Component to show elapsed time at each step
const StepTimer = ({ start, label = 'Tempo esperando' }) => {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-blue-100 rounded border border-blue-300">
      <span className="text-sm text-gray-700">{label}:</span>
      <span className="text-sm font-bold text-blue-600"><ElapsedTimer start={start} /></span>
    </div>
  );
};

// CSS for truck animation
const truckStyles = `
.truck-container { position: relative; height: 60px; }
`;

const ProgramadasEntregas = () => {
  const navigate = useNavigate();
  const [programacoes, setProgramacoes] = useState([]);
  const [allProgramacoes, setAllProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { user } = useAuth();
  
  // Modal flow states
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [currentDelivery, setCurrentDelivery] = useState(null);
  const [currentProgramacao, setCurrentProgramacao] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [observations, setObservations] = useState('');
  const [justification, setJustification] = useState('');
  const [documentsUpload, setDocumentsUpload] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    loadProgramacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      const res = await deliveryService.getProgramacoesAssigned();
      const todas = res.data.programacoes || [];
      setAllProgramacoes(todas);
      // Filtra para mostrar apenas as do contratado igual ao nome do usuário logado
      if (user && user.name) {
        const nome = String(user.name).trim().toUpperCase();
        setProgramacoes(todas.filter(p => String(p.contratado).trim().toUpperCase() === nome));
      } else {
        setProgramacoes([]);
      }
    } catch (err) {
      console.error('Erro ao buscar programações:', err);
      setToast({ message: 'Erro ao carregar entregas programadas', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartDelivery = async (p) => {
    // Use container as deliveryNumber if available, fallback to processo
    const deliveryNumber = (p.container && p.container.trim()) || (p.processo && p.processo.trim());
    if (!deliveryNumber) {
      setToast({ message: 'Não foi possível iniciar: sem número de container/processo', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      // First check if a delivery with this number already exists for this driver
      let existing = null;
      try {
        const searchRes = await deliveryService.getMyDeliveries({ q: deliveryNumber.toUpperCase() });
        const list = searchRes.data.deliveries || [];
        existing = list.find(d => String(d.deliveryNumber).toUpperCase() === deliveryNumber.toUpperCase());
      } catch (err) {
        console.warn('Erro ao buscar entregas existentes:', err);
      }

      if (existing) {
        // Re-use existing delivery and restore step
        setCurrentDelivery(existing);
        setCurrentProgramacao(p);
        const restoredStep = existing.currentStep || (existing.status === 'pending' ? 'welcome' : 'welcome');
        setCurrentStep(restoredStep);
        setPhotos([]);
        setObservations('');
        setJustification('');
        setDocumentsUpload({});
        setShowModal(true);
        setToast({ message: 'Entrega retomada', type: 'success' });
        loadProgramacoes();
      } else {
        const payload = {
          deliveryNumber: deliveryNumber.toUpperCase(),
          vehiclePlate: '',
          observations: `Criada a partir da Programação ${p.processo || ''}`,
          driverName: p.motorista || user?.fullName || user?.name || ''
        };

        const res = await deliveryService.createDelivery(payload);
        const newDelivery = res.data.delivery;
        setCurrentDelivery(newDelivery);
        setCurrentProgramacao(p);
        setCurrentStep(newDelivery.currentStep || 'welcome');
        setPhotos([]);
        setObservations('');
        setJustification('');
        setDocumentsUpload({});
        setShowModal(true);
        loadProgramacoes();
      }
    } catch (err) {
      console.error('Erro ao iniciar entrega:', err);
      setToast({ message: err.response?.data?.message || 'Erro ao iniciar entrega', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentStep('welcome');
    setCurrentDelivery(null);
    setCurrentProgramacao(null);
    setPhotos([]);
    setObservations('');
    setJustification('');
    setDocumentsUpload({});
    loadProgramacoes();
  };

  const goToStep = async (step) => {
    setPhotos([]);
    setCurrentStep(step);
    // Persist current step to backend so reopening restores progress
    try {
      if (currentDelivery && currentDelivery._id) {
        await deliveryService.updateDelivery(currentDelivery._id, { currentStep: step });
        // Refresh delivery locally
        const refreshed = await deliveryService.getDelivery(currentDelivery._id);
        setCurrentDelivery(refreshed.data.delivery);
      }
    } catch (err) {
      console.warn('Não foi possível persistir etapa atual da entrega:', err?.message || err);
    }
  };

  const addPhoto = (photo) => {
    setPhotos([...photos, photo]);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        addPhoto(event.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleObservationSubmit = async () => {
    if (!observations.trim()) {
      setToast({ message: 'Informe a observação', type: 'error' });
      return;
    }
    try {
      await deliveryService.updateDelivery(currentDelivery._id, { observations });
      setToast({ message: 'Observação registrada', type: 'success' });
      goToStep('welcome');
    } catch (err) {
      setToast({ message: 'Erro ao salvar observação', type: 'error' });
    }
  };

  const handlePhotoUploadArrival = async () => {
    if (!photos || photos.length === 0) {
      setToast({ message: 'Tire ao menos uma foto', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      photos.forEach((photo) => {
        const blob = dataURLtoBlob(photo);
        formData.append('file', blob);
      });
      await deliveryService.uploadDocument(currentDelivery._id, 'arrivalPhotos', Array.from(formData.getAll('file')));
      // Mudar status para AGUARDANDO_DESOVA
      await deliveryService.updateDelivery(currentDelivery._id, { arrivedAt: new Date().toISOString(), status: 'AGUARDANDO_DESOVA' });
      setToast({ message: 'Chegada confirmada', type: 'success' });
      goToStep('confirmDesova');
      // Não remover da tela, apenas atualizar status
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDesovaStartUpload = async () => {
    if (!photos || photos.length === 0) {
      setToast({ message: 'Tire ao menos uma foto', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      photos.forEach((photo) => {
        const blob = dataURLtoBlob(photo);
        formData.append('file', blob);
      });
      await deliveryService.uploadDocument(currentDelivery._id, 'desovaStartPhotos', Array.from(formData.getAll('file')));
      await deliveryService.updateDelivery(currentDelivery._id, { status: 'EM_DESOVA' });
      setToast({ message: 'Desova iniciada', type: 'success' });
      goToStep('desovaProgress');
      // optionally refresh programacoes, though should already be removed
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJustificationSubmit = async () => {
    if (!justification.trim()) {
      setToast({ message: 'Informe a justificativa', type: 'error' });
      return;
    }
    try {
      const obs = `(DESOVA NÃO INICIADA) ${justification}`;
      await deliveryService.updateDelivery(currentDelivery._id, { observations: obs });
      setToast({ message: 'Justificativa enviada', type: 'success' });
      goToStep('confirmDesova');
    } catch (err) {
      setToast({ message: 'Erro ao enviar justificativa', type: 'error' });
    }
  };

  const handleDesovaFinalUpload = async () => {
    if (!photos || photos.length === 0) {
      setToast({ message: 'Tire ao menos uma foto', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      photos.forEach((photo) => {
        const blob = dataURLtoBlob(photo);
        formData.append('file', blob);
      });
      await deliveryService.uploadDocument(currentDelivery._id, 'desovaFinalPhotos', Array.from(formData.getAll('file')));
      await deliveryService.updateDelivery(currentDelivery._id, { status: 'DESOVA_FINALIZADA' });
      setToast({ message: 'Desova finalizada', type: 'success' });
      goToStep('askSchedule');
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleDecision = async (shouldSchedule) => {
    if (shouldSchedule) {
      try {
        const obs = '(SOLICITACAO_AGENDAMENTO) Motorista solicitou agendamento de devolução do container.';
        await deliveryService.updateDelivery(currentDelivery._id, { observations: obs });
        setToast({ message: 'Solicitação de agendamento enviada ao admin', type: 'success' });
      } catch (err) {
        setToast({ message: 'Erro ao enviar solicitação', type: 'error' });
      }
    }
    goToStep('finalDocs');
  };

  const handleFinalUploadAndSubmit = async () => {
    const docs = Object.keys(documentsUpload).filter(key => documentsUpload[key] && documentsUpload[key].length > 0);
    if (docs.length === 0) {
      setToast({ message: 'Envie ao menos um documento', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      for (const docType of docs) {
        const files = documentsUpload[docType];
        await deliveryService.uploadDocument(currentDelivery._id, docType, files);
      }
      await deliveryService.updateDelivery(currentDelivery._id, { status: 'ENTREGUE' });
      setToast({ message: 'Entrega finalizada com sucesso!', type: 'success' });
      setTimeout(() => {
        closeModal();
        loadProgramacoes();
      }, 1500);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar documentos', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const dataURLtoBlob = (dataUrl) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  return (
    <div className="bg-gray-100">
      <div className="max-w-6xl mx-auto p-4 pb-20">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6 transition"
        >
          <FaArrowLeft />
          Voltar
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-6">Entregas Programadas</h2>

        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : programacoes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg mb-4">Nenhuma entrega programada encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {programacoes.map((p) => (
              <div key={p._id} className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Processo: {p.processo}</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-gray-500">Data Agendamento</p>
                        <p className="font-medium">{p.dataAgendamento ? new Date(p.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Recebedor</p>
                        <p className="font-medium">{p.recebedor || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Container</p>
                        <p className="font-medium">{p.container || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Status</p>
                        <p className="font-medium">
                          {/* Status amigável para cada etapa */}
                          {(!p.status || p.status === 'pending' || p.status === 'PENDING') ? 'AGENDADO' :
                            p.status === 'AGUARDANDO_DESOVA' ? 'AGUARDANDO DESOVA' :
                            p.status === 'EM_DESOVA' ? 'EM DESOVA' :
                            p.status === 'AGUARDANDO_ANEXO' ? 'AGUARDANDO ANEXO DOS DOCUMENTOS' :
                            p.status === 'ENTREGUE' ? 'ENTREGUE' :
                            p.status === 'CANCELADO' ? 'CANCELADO' :
                            p.status}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500">Contratado</p>
                        <p className="font-medium">{p.contratado || '-'}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Motorista</p>
                        <p className="font-medium">{p.motorista || '-'}</p>
                      </div>
                    </div>
                  </div>

                    <div className="flex gap-2 ml-4">
                      
                      {/* Exibe botão para todos os status, exceto ENTREGUE/CANCELADO */}
                      {(!['ENTREGUE','CANCELADO'].includes((p.status||'').toString())) && (
                        <button
                          onClick={() => handleStartDelivery(p)}
                          className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition font-semibold"
                          title={(!p.status || p.status === 'pending' || p.status === 'PENDING' || p.status === 'AGENDADO') ? 'Iniciar Entrega' : 'Continuar Entrega'}
                        >
                          {(!p.status || p.status === 'pending' || p.status === 'PENDING' || p.status === 'AGENDADO') ? 'Iniciar Entrega' : 'Continuar Entrega'}
                        </button>
                      )}
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Modal de fluxo de entrega */}
      {showModal && currentDelivery && currentProgramacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <style>{truckStyles}</style>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Fluxo de Entrega</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">
                <FaTimes size={24} />
              </button>
            </div>

            {/* STEP 1: Welcome */}
            {currentStep === 'welcome' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-lg mb-2">
                    Olá <strong>{currentProgramacao?.motorista || (currentDelivery && currentDelivery.driverName) || user?.fullName || user?.name || 'Motorista'}</strong>,
                  </p>
                  <p className="text-lg mb-2">
                    Sua entrega no <strong>{currentProgramacao?.recebedor || 'Rufino'}</strong> está agendada para:
                  </p>
                  <p className="text-xl font-bold text-blue-600">
                    {new Date(currentProgramacao?.dataAgendamento).toLocaleString('pt-BR', {
                      dateStyle: 'long',
                      timeStyle: 'short'
                    })}
                  </p>
                  {/* Truck animation + elapsed timer when delivery is en route */}
                  {(currentDelivery && ['pending', 'PENDING', 'EM_ROTA'].includes((currentDelivery.status || '').toString())) && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg min-h-16 overflow-hidden relative border-2 border-purple-200" style={{position: 'relative'}}>
                        <ProgressiveTruck start={currentDelivery.createdAt} />
                      </div>
                      <div className="text-sm text-gray-700 font-medium text-right">Tempo de rota:<br /><span className="text-base font-bold text-blue-600"><ElapsedTimer start={currentDelivery.createdAt} /></span></div>
                    </div>
                  )}
                  <p className="text-gray-600 mt-3">Confirme sua chegada no cliente</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToStep('arrival')}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                  >
                    ✓ Cheguei no cliente
                  </button>
                  <button
                    onClick={() => goToStep('obs')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    📝 Observação
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Observação */}
            {currentStep === 'obs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Observação</h3>
                <StepTimer start={currentDelivery?.createdAt} label="Tempo aguardando" />
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="Digite sua observação..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleObservationSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    Enviar
                  </button>
                  <button
                    onClick={() => goToStep('welcome')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Foto de chegada */}
            {currentStep === 'arrival' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">📸 Registre sua chegada no cliente</h3>
                <StepTimer start={currentDelivery?.createdAt} label="Tempo em rota" />
                <p className="text-gray-600">Tire uma ou mais fotos</p>
                
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                        >
                          <FaTimes size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <FaCamera /> Tirar foto
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={handlePhotoUploadArrival}
                    disabled={submitting || photos.length === 0}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                  >
                    Enviar registro
                  </button>
                  <button
                    onClick={() => goToStep('welcome')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Confirme desova */}
            {currentStep === 'confirmDesova' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">Confirme o início da desova</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Aguardando desova" />
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-400 p-4 rounded-lg">
                  <p className="text-gray-800 font-medium mb-2">📦 Selecione uma das opções:</p>
                  <p className="text-sm text-gray-600">Indique se a desova foi iniciada ou não</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToStep('desovaStart')}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-emerald-700 shadow-md transition"
                  >
                    ✓ Desova iniciada
                  </button>
                  <button
                    onClick={() => goToStep('desovaJustify')}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-lg font-semibold hover:from-red-500 hover:to-red-600 shadow-md transition"
                  >
                    ✗ Desova não iniciada
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: Justificativa desova */}
            {currentStep === 'desovaJustify' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Por que a desova não foi iniciada?</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo aguardando" />
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="Digite a justificativa..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleJustificationSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Enviar justificativa
                  </button>
                  <button
                    onClick={() => goToStep('confirmDesova')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: Foto de início da desova */}
            {currentStep === 'desovaStart' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">📸 Registre o início da desova</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo no cliente" />
                <p className="text-gray-600">Tire uma ou mais fotos</p>
                
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                        >
                          <FaTimes size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <FaCamera /> Tirar foto
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleDesovaStartUpload}
                    disabled={submitting || photos.length === 0}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Confirmar desova
                  </button>
                  <button
                    onClick={() => goToStep('confirmDesova')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 7: Progresso da desova */}
            {currentStep === 'desovaProgress' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">A desova já finalizou?</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo em desova" />
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-gray-700">Indique se a desova foi completada</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToStep('desovaFinal')}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    ✓ Sim, finalizou
                  </button>
                  <button
                    onClick={() => goToStep('desovaStart')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Ainda não
                  </button>
                </div>
              </div>
            )}

            {/* STEP 8: Foto de finalização */}
            {currentStep === 'desovaFinal' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">📸 Registre a finalização da desova</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo em desova" />
                <p className="text-gray-600">Tire uma ou mais fotos</p>
                
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                        >
                          <FaTimes size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <FaCamera /> Tirar foto
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleDesovaFinalUpload}
                    disabled={submitting || photos.length === 0}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    Enviar
                  </button>
                  <button
                    onClick={() => goToStep('desovaProgress')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 9: Ask Schedule */}
            {currentStep === 'askSchedule' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Deseja fazer o agendamento da devolução do Container?</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo total na entrega" />
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                  <p className="text-gray-700">Se você clicar em "Sim", o administrativo será notificado para agendamento</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScheduleDecision(true)}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Sim - Agendar
                  </button>
                  <button
                    onClick={() => handleScheduleDecision(false)}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Não
                  </button>
                </div>
              </div>
            )}

            {/* STEP 10: Final Documents */}
            {currentStep === 'finalDocs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">📄 Documentos Finais</h3>
                <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo total na entrega" />
                <p className="text-gray-600 mb-4">Anexe os documentos da entrega</p>

                {['canhotNF', 'canhotCTE', 'diarioBordo', 'devolucaoVazio', 'retiradaCheio'].map((docType) => {
                  const labels = {
                    canhotNF: 'Canhoto NF',
                    canhotCTE: 'Canhoto CTE',
                    diarioBordo: 'Diário de Bordo',
                    devolucaoVazio: 'Devolução Vazio',
                    retiradaCheio: 'Retirada Cheio'
                  };
                  return (
                    <div key={docType} className="border border-gray-300 p-3 rounded-lg">
                      <p className="font-semibold text-sm mb-2">{labels[docType]}</p>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) {
                            setDocumentsUpload({
                              ...documentsUpload,
                              [docType]: Array.from(e.target.files)
                            });
                          }
                        }}
                        className="w-full text-sm"
                      />
                      {documentsUpload[docType] && documentsUpload[docType].length > 0 && (
                        <p className="text-xs text-green-600 mt-2">✓ {documentsUpload[docType].length} arquivo(s)</p>
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-2">
                  <button
                    onClick={handleFinalUploadAndSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                  >
                    Finalizar entrega
                  </button>
                  <button
                    onClick={() => goToStep('askSchedule')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramadasEntregas;
