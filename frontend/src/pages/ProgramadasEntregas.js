import { deliveryService, adminService } from '../services/authService';
import React, { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { FaArrowLeft, FaCalendarAlt, FaSearch, FaCamera, FaTimes } from 'react-icons/fa';
import { useAuth } from '../services/authContext';

// Barra de progresso simples
const ProgressBar = ({ progress }) => (
  <div className="w-full bg-gray-200 rounded h-3 mt-2">
    <div
      className="bg-blue-500 h-3 rounded transition-all"
      style={{ width: `${progress}%` }}
    ></div>
  </div>
);

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
  const [deliveriesMap, setDeliveriesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { user } = useAuth();

  // Estado para barra de progresso de upload
  const [uploadProgress, setUploadProgress] = useState(0);

  // Modal flow states
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [currentDelivery, setCurrentDelivery] = useState(null);
  const [currentProgramacao, setCurrentProgramacao] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [observations, setObservations] = useState('');
  const [justification, setJustification] = useState('');
  const [documentsUpload, setDocumentsUpload] = useState({});
  const [documentsJustification, setDocumentsJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Montagem flow states
  const [showMontagemModal, setShowMontagemModal] = useState(false);
  const [montagemProgramacao, setMontagemProgramacao] = useState(null);
  const [montagemSubmitting, setMontagemSubmitting] = useState(false);
  const [montagemComprovante, setMontagemComprovante] = useState(null);
  const montagemComprovanteRef = useRef(null);

  // states for devolução vazia modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnProof, setReturnProof] = useState(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  useEffect(() => {
    loadProgramacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      // Busca sempre da base de dados geral
      const res = await adminService.getProgramacoes();
      const todas = res.data.programacoes || [];
      setAllProgramacoes(todas);
      let nomeFiltro = '';
      if (user) {
        nomeFiltro = (user.username || user.name || '').trim().toUpperCase();
      }
      // Filtra por contratado igual antes
      let filtradas = [];
      if (nomeFiltro) {
        filtradas = todas.filter(p => String(p.contratado).trim().toUpperCase() === nomeFiltro);
      }
      setProgramacoes(filtradas);

      // Busca todas as deliveries para alimentar colunas
      const deliveriesRes = await deliveryService.getMyDeliveries({});
      const deliveries = deliveriesRes.data.deliveries || [];
      // Mapeia por deliveryNumber
      const map = {};
      deliveries.forEach(d => {
        map[(d.deliveryNumber || '').toUpperCase()] = d;
      });
      setDeliveriesMap(map);
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
        
        // Se status é CONTAINER_MONTADO, mudar para A_CAMINHO_DO_CLIENTE
        if (existing.status === 'CONTAINER_MONTADO') {
          console.log('[DEBUG] Updating delivery status from CONTAINER_MONTADO to A_CAMINHO_DO_CLIENTE');
          await deliveryService.updateDelivery(existing._id, { status: 'A_CAMINHO_DO_CLIENTE' });
          existing.status = 'A_CAMINHO_DO_CLIENTE';
          // Update local programação to reflect new status immediately
          p.status = 'A_CAMINHO_DO_CLIENTE';
        }
        
        // Determina o step inicial conforme o status
        let restoredStep = 'welcome';
        switch ((existing.status || '').toUpperCase()) {
          case 'AGUARDANDO_DESOVA':
            restoredStep = 'confirmDesova';
            break;
          case 'EM_DESOVA':
            restoredStep = 'desovaProgress';
            break;
          case 'AGUARDANDO_ANEXO':
          case 'ANEXANDO_DOCUMENTOS_FINAIS':
            restoredStep = 'finalDocs';
            break;
          case 'AGUARDANDO_AGENDAMENTO_DEVOLUCAO':
            restoredStep = 'askSchedule';
            break;
          case 'ENTREGUE':
            restoredStep = 'finalDocs';
            break;
          case 'PENDING':
          case 'EM_ROTA':
          case 'A_CAMINHO_DO_CLIENTE':
          default:
            restoredStep = 'welcome';
        }
        // Se currentStep já estiver salvo, SEMPRE prioriza ele (mesmo se status mudou)
        if (existing.currentStep) {
          setCurrentStep(existing.currentStep);
        } else {
          setCurrentStep(restoredStep);
        }
        setPhotos([]);
        setObservations('');
        setJustification('');
        setDocumentsUpload({});
        setShowModal(true);
        setToast({ message: 'Entrega retomada', type: 'success' });
        await loadProgramacoes();
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
        await loadProgramacoes();
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
    setDocumentsJustification('');
    loadProgramacoes();
  };

  const handleStartMontagem = async (p) => {
    setMontagemProgramacao(p);
    setShowMontagemModal(true);
  };

  // Show return modal for a programação
  const openReturnModal = (p) => {
    setCurrentProgramacao(p);
    setReturnProof(null);
    setShowReturnModal(true);
  };

  const closeReturnModal = () => {
    setShowReturnModal(false);
    setReturnProof(null);
    setCurrentProgramacao(null);
  };

  // marcar devolução vazia como finalizada (invocado pelo modal)
  const handleReturn = async () => {
    if (!currentProgramacao) return;
    setReturnSubmitting(true);
    try {
      // if there's a linked delivery, update it
      if (currentProgramacao.linkedDeliveryId) {
        await deliveryService.updateDelivery(currentProgramacao.linkedDeliveryId, { status: 'FINALIZADO' });
        if (returnProof) {
          await deliveryService.uploadDocument(currentProgramacao.linkedDeliveryId, 'devolucaoVazio', returnProof);
        }
      } else {
        // search by number and update
        const searchVal = (currentProgramacao.container || currentProgramacao.processo || '').trim();
        if (searchVal) {
          const resp = await deliveryService.getMyDeliveries({ searchTerm: searchVal });
          const found = resp.data.deliveries && resp.data.deliveries[0];
          if (found) {
            await deliveryService.updateDelivery(found._id, { status: 'FINALIZADO' });
            if (returnProof) {
              await deliveryService.uploadDocument(found._id, 'devolucaoVazio', returnProof);
            }
          }
        }
      }

      // update programacao as well
      try {
        await adminService.updateProgramacao(currentProgramacao._id, { status: 'FINALIZADO' });
      } catch (_) {}

      setToast({ message: 'Devolução vazia registrada', type: 'success' });
      await loadProgramacoes();
      closeReturnModal();
    } catch (err) {
      console.error('Erro ao registrar devolução:', err);
      setToast({ message: 'Erro ao fazer devolução', type: 'error' });
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleMontagemFinished = async (finished) => {
    if (!finished) {
      // User said "Não" - show the question again (by staying in the modal)
      return;
    }

    // User said "Sim" - require comprovante and update programacao status to CONTAINER_MONTADO
    if (!montagemComprovante) {
      setToast({ message: 'Anexe o comprovante da montagem antes de continuar', type: 'error' });
      return;
    }

    // User said "Sim" - update programacao status to CONTAINER_MONTADO
    try {
      setMontagemSubmitting(true);
      const programacaoId = montagemProgramacao._id;
      
      // Update the programacao status via admin API or delivery update
      // For now, we'll assume we can directly update it as the delivery status mirrors back
      // Create a delivery first to establish the link
      const deliveryNumber = (montagemProgramacao.container && montagemProgramacao.container.trim()) || 
                            (montagemProgramacao.processo && montagemProgramacao.processo.trim());
      if (!deliveryNumber) {
        setToast({ message: 'Não foi possível: sem número de container/processo', type: 'error' });
        setShowMontagemModal(false);
        setMontagemProgramacao(null);
        return;
      }

      // Create delivery with status CONTAINER_MONTADO
      const payload = {
        deliveryNumber: deliveryNumber.toUpperCase(),
        observations: `Montagem finalizada em ${new Date().toLocaleString('pt-BR')}`,
        driverName: montagemProgramacao.motorista || user?.fullName || user?.name || '',
        containerMontadoAt: new Date().toISOString(), // Enviar como ISO string
        status: 'CONTAINER_MONTADO'
      };

      const res = await deliveryService.createDelivery(payload);
      const delivery = res.data.delivery;

      // Upload comprovante como retiradaCheio
      try {
        await deliveryService.uploadDocument(delivery._id, 'retiradaCheio', montagemComprovante);
      } catch (uploadErr) {
        console.warn('Aviso: comprovante não foi salvo, mas prosseguindo:', uploadErr);
      }

      // Update the delivery/programacao status to CONTAINER_MONTADO
      await deliveryService.updateDelivery(delivery._id, { status: 'CONTAINER_MONTADO' });

      setToast({ message: 'Container marcado como montado com sucesso!', type: 'success' });
      setShowMontagemModal(false);
      setMontagemProgramacao(null);
      setMontagemComprovante(null);
      loadProgramacoes();
    } catch (err) {
      console.error('Erro ao finalizar montagem:', err);
      setToast({ message: err?.response?.data?.message || 'Erro ao marcar montagem como finalizada', type: 'error' });
    } finally {
      setMontagemSubmitting(false);
    }
  };

  const closeMontagemModal = () => {
    setShowMontagemModal(false);
    setMontagemProgramacao(null);
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
      // Append observation to existing observations
      const fresh = await deliveryService.getDelivery(currentDelivery._id);
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      const newObs = `${existingObs ? existingObs + '\n' : ''}[${timestamp}] ${observations}`;
      await deliveryService.updateDelivery(currentDelivery._id, { observations: newObs });
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
    setUploadProgress(0);
    try {
      // Compressão das fotos
      const compressedFiles = [];
      for (let i = 0; i < photos.length; i++) {
        const file = dataURLtoFile(photos[i], `foto_${i}.jpg`);
        const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
        compressedFiles.push(compressed);
        setUploadProgress(Math.round(((i + 1) / photos.length) * 30)); // até 30% na compressão
      }
      // Upload com barra de progresso
      await deliveryService.uploadDocument(
        currentDelivery._id,
        'chegadaCliente',
        compressedFiles
      );
      setUploadProgress(100);
      await deliveryService.updateDelivery(currentDelivery._id, { arrivedAt: new Date().toISOString(), status: 'AGUARDANDO_DESOVA' });
      setToast({ message: 'Chegada confirmada', type: 'success' });
      goToStep('confirmDesova');
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };
// Função utilitária para converter dataURL em File
function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}
  // Adicione a barra de progresso visual onde achar melhor, por exemplo, acima do botão de upload:
  // {uploadProgress > 0 && <ProgressBar progress={uploadProgress} />}

  const handleDesovaStartUpload = async () => {
    if (!photos || photos.length === 0) {
      setToast({ message: 'Tire ao menos uma foto', type: 'error' });
      return;
    }
    setSubmitting(true);
    setUploadProgress(0);
    try {
      // Compressão das fotos
      const compressedFiles = [];
      for (let i = 0; i < photos.length; i++) {
        const file = dataURLtoFile(photos[i], `foto_${i}.jpg`);
        const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
        compressedFiles.push(compressed);
        setUploadProgress(Math.round(((i + 1) / photos.length) * 30));
      }
      await deliveryService.uploadDocument(
        currentDelivery._id,
        'inicioDesova',
        compressedFiles
      );
      setUploadProgress(100);
      await deliveryService.updateDelivery(currentDelivery._id, { status: 'EM_DESOVA', currentStep: 'desovaProgress', desovaStartAt: new Date().toISOString() });
      setToast({ message: 'Desova iniciada', type: 'success' });
      goToStep('desovaProgress');
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setUploadProgress(0), 1000);
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
    setUploadProgress(0);
    try {
      // Compressão das fotos
      const compressedFiles = [];
      for (let i = 0; i < photos.length; i++) {
        const file = dataURLtoFile(photos[i], `foto_${i}.jpg`);
        const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
        compressedFiles.push(compressed);
        setUploadProgress(Math.round(((i + 1) / photos.length) * 30));
      }
      await deliveryService.uploadDocument(
        currentDelivery._id,
        'fimDesova',
        compressedFiles
      );
      setUploadProgress(100);
      await deliveryService.updateDelivery(currentDelivery._id, { status: 'DESOVA_FINALIZADA', desovaEndAt: new Date().toISOString() });
      setToast({ message: 'Desova finalizada', type: 'success' });
      goToStep('askSchedule');
      loadProgramacoes();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleScheduleDecision = async (shouldSchedule) => {
    if (shouldSchedule) {
      try {
        const obs = '(SOLICITACAO_AGENDAMENTO) Motorista solicitou agendamento de devolução do container.';
        // Append observation instead of overwriting
        const fresh = await deliveryService.getDelivery(currentDelivery._id);
        const existingObs = fresh.data.delivery.observations || '';
        const timestamp = new Date().toLocaleString('pt-BR');
        const newObs = `${existingObs ? existingObs + '\n' : ''}[${timestamp}] ${obs}`;
        await deliveryService.updateDelivery(currentDelivery._id, { observations: newObs });
        setToast({ message: 'Solicitação de agendamento enviada ao admin', type: 'success' });
      } catch (err) {
        setToast({ message: 'Erro ao enviar solicitação', type: 'error' });
      }
    }
    // Ao entrar nos documentos finais, salva status ANEXANDO_DOCUMENTOS_FINAIS
    console.log('[DEBUG] Updating delivery status to ANEXANDO_DOCUMENTOS_FINAIS');
    await deliveryService.updateDelivery(currentDelivery._id, { status: 'ANEXANDO_DOCUMENTOS_FINAIS', currentStep: 'finalDocs' });
    // Update local programação status immediately
    if (currentProgramacao) {
      currentProgramacao.status = 'ANEXANDO_DOCUMENTOS_FINAIS';
    }
    // Refresh programações list to show updated status
    await loadProgramacoes();
    goToStep('finalDocs');
  };

  const handleFinalUploadAndSubmit = async () => {
    const requiredDocs = ['canhotCTE','diarioBordo','canhotNF'];
    const allOk = requiredDocs.every(k => documentsUpload[k] && documentsUpload[k].length > 0);
    
    // Permite prosseguir se: (1) todos documentos anexados OU (2) sem docs mas com justificativa
    if (!allOk && !documentsJustification.trim()) {
      setToast({ message: 'Anexe todos os documentos ou justifique a falta deles', type: 'error' });
      return;
    }
    
    setSubmitting(true);
    try {
      // Upload documentos que foram anexados
      for (const docType of requiredDocs) {
        if (documentsUpload[docType] && documentsUpload[docType].length > 0) {
          await deliveryService.uploadDocument(currentDelivery._id, docType, documentsUpload[docType]);
        }
      }
      
      // Determina o status final
      const finalStatus = allOk ? 'ENTREGUE' : 'ENTREGUE_COM_PENDENCIA_CANHOTO';
      // Append documents justification to observations as well
      const fresh = await deliveryService.getDelivery(currentDelivery._id);
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      const docsObs = documentsJustification ? `(JUSTIFICATIVA_DOCS) ${documentsJustification}` : '';
      const newObs = `${existingObs ? existingObs + '\n' : ''}${docsObs ? `[${timestamp}] ${docsObs}` : ''}`;

      const updatePayload = {
        status: finalStatus,
        documentsJustification: documentsJustification,
        observations: newObs
      };

      await deliveryService.updateDelivery(currentDelivery._id, updatePayload);
      // Atualiza lista e fecha o fluxo (retorna para a lista de entregas)
      await loadProgramacoes();
      closeModal();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Erro ao enviar documentos', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };
            {/* STEP 11: Mensagem final de agradecimento e feedback */}
            {currentStep === 'agradecimento' && (
              <div className="space-y-6 text-center">
                <div className="text-6xl animate-bounce">🎉</div>
                <h3 className="text-3xl font-bold text-emerald-600">Excelente trabalho!</h3>
                <p className="text-lg text-gray-700 font-medium">Sua entrega foi concluída com sucesso na GeoLog</p>
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 p-6 rounded-lg">
                  <p className="text-base text-gray-700 mb-2">Obrigado por utilizar nosso sistema!</p>
                  <p className="text-sm text-gray-600">Seus documentos foram registrados e a entrega finalizada.</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => { closeModal(); }}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                  >
                    ✓ Voltar à lista
                  </button>
                </div>
              </div>
            )}


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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 w-full">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Processo: {p.processo}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-gray-500">Data Agendamento</p>
                        <p className="font-medium">{p.dataAgendamento ? new Date(p.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Recebedor</p>
                        <p className="font-bold text-lg text-purple-700 bg-purple-100 rounded px-2 py-1 shadow-sm">{p.recebedor || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Container</p>
                        <p className="font-medium">{p.container || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        <span className={
                          `font-bold px-2 py-1 rounded-lg text-xs ${
                            (!p.status || p.status === 'pending' || p.status === 'PENDING') ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                            p.status === 'AGUARDANDO_DESOVA' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                            p.status === 'EM_DESOVA' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                            p.status === 'AGUARDANDO_ANEXO' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                            p.status === 'AGUARDANDO_AGENDAMENTO_DEVOLUCAO' ? 'bg-pink-100 text-pink-800 border border-pink-300' :
                            p.status === 'ANEXANDO_DOCUMENTOS_FINAIS' ? 'bg-green-100 text-green-800 border border-green-300' :
                            p.status === 'ENTREGUE' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                            p.status === 'FINALIZADO' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                            p.status === 'CANCELADO' ? 'bg-gray-200 text-gray-700 border border-gray-300' :
                            'bg-gray-100 text-gray-700 border border-gray-300'
                          }`
                        }>
                          {(!p.status || p.status === 'pending' || p.status === 'PENDING') ? 'AGENDADO' :
                            p.status === 'AGUARDANDO_DESOVA' ? 'AGUARDANDO DESOVA' :
                            p.status === 'EM_DESOVA' ? 'EM DESOVA' :
                            p.status === 'AGUARDANDO_ANEXO' ? 'AGUARDANDO ANEXO DOS DOCUMENTOS' :
                            p.status === 'AGUARDANDO_AGENDAMENTO_DEVOLUCAO' ? 'AGUARDANDO AGENDAMENTO DE DEVOLUÇÃO' :
                            p.status === 'ANEXANDO_DOCUMENTOS_FINAIS' ? 'ANEXANDO DOCUMENTOS FINAIS' :
                            p.status === 'ENTREGUE' ? 'PENDENTE DEVOLUÇÃO VAZIO' :
                            p.status === 'FINALIZADO' ? 'FINALIZADO' :
                            p.status === 'CANCELADO' ? 'CANCELADO' :
                            p.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-500">Contratado</p>
                        <p className="font-medium">{p.contratado || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Motorista</p>
                        <p className="font-bold text-lg text-emerald-700 bg-emerald-100 rounded px-2 py-1 shadow-sm">{p.motorista || '-'}</p>
                      </div>

                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0 justify-end">
                    {/* Para AGENDADO: mostrar "Iniciar montagem" */}
                    {(!p.status || p.status === 'pending' || p.status === 'PENDING' || p.status === 'AGENDADO') && (
                      <button
                        onClick={() => handleStartMontagem(p)}
                        className="px-6 py-2 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl shadow-lg hover:scale-105 hover:shadow-xl transition font-bold text-lg border-2 border-blue-500"
                        title="Iniciar Montagem"
                      >
                        Iniciar Montagem
                      </button>
                    )}

                    {/* Para CONTAINER_MONTADO e outros: mostrar "Iniciar entrega" */}
                    {p.status === 'CONTAINER_MONTADO' && (
                      <button
                        onClick={() => handleStartDelivery(p)}
                        className="px-6 py-2 bg-gradient-to-r from-emerald-400 to-emerald-600 text-white rounded-xl shadow-lg hover:scale-105 hover:shadow-xl transition font-bold text-lg border-2 border-emerald-500"
                        title="Iniciar Entrega"
                      >
                        Iniciar Entrega
                      </button>
                    )}

                    {/* Para status ENTREGUE mostramos retorno vazio */}
                    {p.status === 'ENTREGUE' && (
                      <button
                        onClick={() => openReturnModal(p)}
                        className="px-6 py-2 bg-gradient-to-r from-pink-400 to-pink-600 text-white rounded-xl shadow-lg hover:scale-105 hover:shadow-xl transition font-bold text-lg border-2 border-pink-500"
                        title="Fazer Devolução"
                      >
                        Fazer devolução
                      </button>
                    )}
                    {/* Para outros status (não finalizados, não agendado, não container_montado): mostrar "Continuar entrega" */}
                    {p.status && !['AGENDADO', 'CONTAINER_MONTADO', 'ENTREGUE', 'CANCELADO', 'pending', 'PENDING'].includes(p.status) && (
                      <button
                        onClick={() => handleStartDelivery(p)}
                        className="px-6 py-2 bg-gradient-to-r from-emerald-400 to-emerald-600 text-white rounded-xl shadow-lg hover:scale-105 hover:shadow-xl transition font-bold text-lg border-2 border-emerald-500"
                        title="Continuar Entrega"
                      >
                        Continuar Entrega
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

      {/* Modal de devolução vazia */}
      {showReturnModal && currentProgramacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 border-4 border-pink-400">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-3xl font-extrabold text-pink-700">Devolução de Vazio</h2>
              <button onClick={closeReturnModal} className="text-gray-500 hover:text-gray-800">
                <FaTimes size={28} />
              </button>
            </div>
            <div className="space-y-6">
              <p className="text-lg">
                Anexe o comprovante da devolução para concluir o processo.
              </p>

              <div className="bg-gray-50 border border-gray-300 p-6 rounded-lg">
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  📸 Comprovante de Devolução
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition"
                  >
                    {returnProof ? '✅ Foto selecionada' : '📷 Selecionar Foto'}
                  </button>
                  {returnProof && (
                    <button
                      onClick={() => setReturnProof(null)}
                      className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setReturnProof(file);
                  }}
                  className="hidden"
                />
                {returnProof && (
                  <p className="text-sm text-gray-600 mt-2">
                    Arquivo: <strong>{returnProof.name}</strong>
                  </p>
                )}
              </div>

              {returnSubmitting && (
                <div className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-300 rounded-lg animate-pulse">
                  <svg className="animate-spin h-6 w-6 text-pink-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  <span className="text-pink-700 font-semibold">Processando...</span>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleReturn}
                  disabled={returnSubmitting || !returnProof}
                  className="flex-1 px-8 py-4 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-bold text-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✅ Enviar Devolução
                </button>
                <button
                  onClick={closeReturnModal}
                  className="flex-1 px-8 py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold text-xl transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pergunta - Informe a conclusão da montagem */}
      {showMontagemModal && montagemProgramacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-10 border-4 border-blue-400">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-extrabold text-blue-700">Montagem de Container</h2>
              <button onClick={closeMontagemModal} className="text-gray-500 hover:text-gray-800">
                <FaTimes size={28} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                <p className="text-lg mb-4">
                  <strong>Processo:</strong> {montagemProgramacao.processo}
                </p>
                <p className="text-lg mb-4">
                  <strong>Container:</strong> {montagemProgramacao.container || '-'}
                </p>
                <p className="text-lg mb-4">
                  <strong>Recebedor:</strong> {montagemProgramacao.recebedor || '-'}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 p-6 rounded-lg">
                <p className="text-2xl font-bold text-yellow-800 text-center">
                  Informe a conclusão da montagem
                </p>
              </div>

              {/* Campo para anexar comprovante */}
              <div className="bg-gray-50 border border-gray-300 p-6 rounded-lg">
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  📸 Anexar Comprovante de Montagem
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => montagemComprovanteRef.current?.click()}
                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                  >
                    {montagemComprovante ? '✅ Foto selecionada' : '📷 Selecionar Foto'}
                  </button>
                  {montagemComprovante && (
                    <button
                      onClick={() => setMontagemComprovante(null)}
                      className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <input
                  ref={montagemComprovanteRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setMontagemComprovante(file);
                  }}
                  className="hidden"
                />
                {montagemComprovante && (
                  <p className="text-sm text-gray-600 mt-2">
                    Arquivo: <strong>{montagemComprovante.name}</strong>
                  </p>
                )}
              </div>

              {montagemSubmitting && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-300 rounded-lg animate-pulse">
                  <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  <span className="text-blue-700 font-semibold">Processando...</span>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => handleMontagemFinished(true)}
                  disabled={montagemSubmitting || !montagemComprovante}
                  className="flex-1 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✅ Container Montado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de fluxo de entrega */}
      {showModal && currentDelivery && currentProgramacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto p-10 border-4 border-emerald-400">
            <style>{truckStyles}</style>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-extrabold text-emerald-700">Fluxo de Entrega</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">
                <FaTimes size={28} />
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
                  <StepTimer start={currentDelivery?.createdAt || currentProgramacao?.dataAgendamento} label="Tempo até confirmação" />
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
                    onClick={() => goToStep('desovaNotYet')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Ainda não
                  </button>
                </div>
              </div>
            )}

            {/* STEP 7.1: Desova ainda não finalizada - relatar algo? */}
            {currentStep === 'desovaNotYet' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Deseja relatar algum problema ou observação?</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToStep('desovaNotYetObs')}
                    className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600"
                  >
                    Sim, quero relatar
                  </button>
                  <button
                    onClick={() => goToStep('desovaNotYetMsg')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Não, está tudo certo
                  </button>
                </div>
              </div>
            )}

            {/* STEP 7.2: Relatar observação */}
            {currentStep === 'desovaNotYetObs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Relate o que está acontecendo</h3>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="Digite sua observação..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => { await handleJustificationSubmit(); goToStep('desovaProgress'); }}
                    disabled={submitting || !justification.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    Enviar observação
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

            {/* STEP 7.3: Mensagem de ok, volta para pergunta */}
            {currentStep === 'desovaNotYetMsg' && (
              <div className="space-y-4 text-center">
                <h3 className="text-lg font-semibold text-green-700">Ok, quando finalizar nos informe!</h3>
                <button
                  onClick={() => goToStep('desovaProgress')}
                  className="mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Voltar para a pergunta
                </button>
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

                {submitting && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-300 rounded-lg animate-pulse">
                    <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                    <span className="text-blue-700 font-semibold">Enviando documentos finais, aguarde...</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {['canhotCTE', 'diarioBordo', 'canhotNF'].map((docType) => {
                    const labels = {
                      canhotCTE: 'Canhoto CTE',
                      canhotNF: 'Canhoto NF',
                      diarioBordo: 'Diário Bordo'
                    };
                    const emojis = {
                      canhotCTE: '🚛',
                      canhotNF: '📦',
                      diarioBordo: '📋'
                    };
                    return (
                      <div key={docType} className="border-2 border-gray-300 p-4 rounded-lg bg-white hover:bg-gray-50 transition shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-purple-50 text-purple-600 text-lg flex-shrink-0">{emojis[docType]}</span>
                          <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">{labels[docType]}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (submitting) return;
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*,application/pdf';
                              input.multiple = true;
                              input.onchange = (e) => {
                                if (e.target.files) {
                                  setDocumentsUpload({
                                    ...documentsUpload,
                                    [docType]: Array.from(e.target.files)
                                  });
                                }
                              };
                              input.click();
                            }}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs w-full"
                            disabled={submitting}
                          >
                            📤 Escolher
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (submitting) return;
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.capture = 'environment';
                              input.onchange = (e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  setDocumentsUpload(prev => ({
                                    ...prev,
                                    [docType]: [...(prev[docType] || []), ...Array.from(e.target.files)]
                                  }));
                                }
                              };
                              input.click();
                            }}
                            className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs w-full"
                            disabled={submitting}
                          >
                            📷 Tirar foto
                          </button>
                        </div>
                        {documentsUpload[docType] && documentsUpload[docType].length > 0 && (
                          <div className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                            ✓ {documentsUpload[docType].length} arquivo(s)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Campo de justificativa - mostrar se não houver todos documentos */}
                {!['canhotCTE','diarioBordo','canhotNF'].every(k => documentsUpload[k] && documentsUpload[k].length > 0) && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-yellow-900 mb-2">
                      ⚠️ Algum problema com os Canhotos da entrega? Justifique:
                    </label>
                    <textarea
                      value={documentsJustification}
                      onChange={(e) => setDocumentsJustification(e.target.value)}
                      placeholder="Descreva o motivo pelo qual algum documento não pode ser anexado..."
                      className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows="3"
                      disabled={submitting}
                    />
                    {!documentsJustification.trim() && (
                      <p className="text-xs text-yellow-700 mt-2">* Campo obrigatório para finalizar sem todos os documentos</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleFinalUploadAndSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Enviando...' : '✓ Finalizar entrega'}
                  </button>
                  <button
                    onClick={() => goToStep('askSchedule')}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                    disabled={submitting}
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
