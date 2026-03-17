import { deliveryService, adminService } from '../services/authService';
import React, { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { useNavigate, useLocation } from 'react-router-dom';
import Toast from '../components/Toast';
import {
  FaArrowLeft, FaCalendarAlt, FaSearch, FaCamera, FaTimes,
  FaTruck, FaBox, FaCheckCircle, FaClipboardList, FaMapMarkerAlt,
  FaUser, FaIdCard, FaFileAlt, FaChevronRight, FaImage, FaUpload,
  FaExclamationTriangle, FaClock, FaRoute, FaWarehouse
} from 'react-icons/fa';
import { MdLocalShipping, MdAssignment } from 'react-icons/md';
import { useAuth } from '../services/authContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';

// ─────────────────────────────────────────────
//  HELPERS & SMALL COMPONENTS
// ─────────────────────────────────────────────

const ProgressBar = ({ progress }) => (
  <div className="w-full bg-white/30 rounded-full h-2 mt-2 overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-300"
      style={{
        width: `${progress}%`,
        background: 'linear-gradient(90deg,#34d399,#059669)'
      }}
    />
  </div>
);

const ElapsedTimer = ({ start }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let s = start ? new Date(start) : new Date();
    if (isNaN(s.getTime())) s = new Date();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - s.getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span className="font-mono">{hh}:{mm}:{ss}</span>;
};

const TruckEmoji = ({ progress = 0 }) => (
  <div className="w-full h-10 bg-white/20 rounded-full relative overflow-hidden">
    <div
      className="absolute inset-y-0 left-0 bg-white/10 rounded-full transition-all duration-500"
      style={{ width: `${Math.min(progress, 100)}%` }}
    />
    <div
      className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 text-2xl"
      style={{ left: `calc(${Math.min(progress, 96)}% - 16px)` }}
    >
      🚚
    </div>
  </div>
);

const ProgressiveTruck = ({ start }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let s = start ? new Date(start) : new Date();
    if (isNaN(s.getTime())) s = new Date();
    const tick = () => setProgress(Math.min(100, ((Date.now() - s.getTime()) / 1800000) * 100));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [start]);
  return <TruckEmoji progress={progress} />;
};

const StepTimer = ({ start, label = 'Tempo esperando' }) => (
  <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
    <div className="flex items-center gap-2">
      <FaClock className="text-blue-500" size={14} />
      <span className="text-sm text-gray-600 font-medium">{label}</span>
    </div>
    <span className="text-base font-bold text-blue-600">
      <ElapsedTimer start={start} />
    </span>
  </div>
);

// Status config map
const STATUS_CONFIG = {
  PENDING: { label: 'AGENDADO', color: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500', icon: FaCalendarAlt },
  pending: { label: 'AGENDADO', color: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500', icon: FaCalendarAlt },
  AGENDADO: { label: 'AGENDADO', color: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500', icon: FaCalendarAlt },
  CONTAINER_MONTADO: { label: 'CONTAINER MONTADO', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', dot: 'bg-indigo-500', icon: FaBox },
  A_CAMINHO_DO_CLIENTE: { label: 'A CAMINHO', color: 'bg-purple-100 text-purple-700 border-purple-300', dot: 'bg-purple-500', icon: FaTruck },
  AGUARDANDO_DESOVA: { label: 'AGUARD. DESOVA', color: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500', icon: FaWarehouse },
  EM_DESOVA: { label: 'EM DESOVA', color: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500', icon: FaWarehouse },
  AGUARDANDO_ANEXO: { label: 'AGUARD. DOCUMENTOS', color: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500', icon: FaFileAlt },
  AGUARDANDO_AGENDAMENTO_DEVOLUCAO: { label: 'AGUARD. AGEND. DEVOLUÇÃO', color: 'bg-pink-100 text-pink-700 border-pink-300', dot: 'bg-pink-500', icon: FaCalendarAlt },
  ANEXANDO_DOCUMENTOS_FINAIS: { label: 'ANEXANDO DOCUMENTOS', color: 'bg-teal-100 text-teal-700 border-teal-300', dot: 'bg-teal-500', icon: FaFileAlt },
  ENTREGUE: { label: 'DEVOLVENDO CONTAINER', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500', icon: FaTruck },
  DEVOLVENDO_CONTAINER: { label: 'DEVOLVENDO CONTAINER', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500', icon: FaTruck },
  FINALIZADO: { label: 'FINALIZADO', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', icon: FaCheckCircle },
  CANCELADO: { label: 'CANCELADO', color: 'bg-gray-200 text-gray-600 border-gray-300', dot: 'bg-gray-400', icon: FaTimes },
};

const StatusBadge = ({ status, containerReturned }) => {
  let key = status || 'pending';
  let overrideLabel = null;
  // show special message when finalizado but still waiting for empty return
  if (key === 'FINALIZADO' && !containerReturned) {
    overrideLabel = 'PEND. DEVOLUÇÃO';
    // reuse color/style from ENTREGUE since it's intermediate
    key = 'ENTREGUE';
  }
  const cfg = STATUS_CONFIG[key] || { label: key, color: 'bg-gray-100 text-gray-600 border-gray-300', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg text-[11px] border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {overrideLabel || cfg.label}
    </span>
  );
};

// Step indicator for modal flows
const FLOW_STEPS = [
  { key: 'welcome',         label: 'Início' },
  { key: 'arrival',         label: 'Chegada' },
  { key: 'confirmDesova',   label: 'Desova' },
  { key: 'desovaProgress',  label: 'Progresso' },
  { key: 'askSchedule',     label: 'Devolução' },
  { key: 'finalDocs',       label: 'Docs' },
];
const STEP_INDEX = Object.fromEntries(FLOW_STEPS.map((s, i) => [s.key, i]));

const FlowStepBar = ({ currentStep }) => {
  const idx = STEP_INDEX[currentStep] ?? 0;
  return (
    <div className="flex items-center justify-between mb-6 px-1">
      {FLOW_STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < idx ? 'bg-emerald-500 text-white shadow-md' :
              i === idx ? 'bg-white border-2 border-emerald-500 text-emerald-600 shadow-lg scale-110' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] font-semibold ${i === idx ? 'text-emerald-600' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < FLOW_STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 rounded transition-all ${i < idx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Photo grid component
const PhotoGrid = ({ photos, onRemove }) => (
  photos.length > 0 ? (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, idx) => (
        <div key={idx} className="relative rounded-xl overflow-hidden shadow-md aspect-square">
          <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
          <button
            onClick={() => onRemove(idx)}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition"
          >
            <FaTimes size={10} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1">
            <span className="text-white text-[10px] font-bold">Foto {idx + 1}</span>
          </div>
        </div>
      ))}
    </div>
  ) : null
);

// Document upload card
const DocUploadCard = ({ docType, label, emoji, value, onChange, onCamera, disabled }) => {
  const hasFiles = value && value.length > 0;
  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${hasFiles ? 'border-emerald-400 bg-emerald-50 shadow-md' : 'border-dashed border-gray-300 bg-gray-50 hover:border-blue-400'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{emoji}</span>
        <p className="text-sm font-bold text-gray-800 uppercase tracking-wide leading-tight">{label}</p>
      </div>
      {hasFiles ? (
        <div className="mb-3 flex items-center gap-2 bg-emerald-100 rounded-lg px-3 py-2">
          <FaCheckCircle className="text-emerald-500" size={14} />
          <span className="text-xs font-bold text-emerald-700">{value.length} arquivo(s)</span>
        </div>
      ) : (
        <div className="mb-3 text-xs text-gray-400 italic text-center py-1">Nenhum arquivo</div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onChange}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
        >
          <FaUpload size={10} /> Arquivo
        </button>
        <button
          type="button"
          onClick={onCamera}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50"
        >
          <FaCamera size={10} /> Câmera
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

const ProgramadasEntregas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [programacoes, setProgramacoes] = useState([]);
  const [allProgramacoes, setAllProgramacoes] = useState([]);
  const [deliveriesMap, setDeliveriesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { user } = useAuth();

  const [uploadProgress, setUploadProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [fromPendingNav, setFromPendingNav] = useState(false);
  const [currentDelivery, setCurrentDelivery] = useState(null);
  const [currentProgramacao, setCurrentProgramacao] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [observations, setObservations] = useState('');
  const [justification, setJustification] = useState('');
  const [documentsUpload, setDocumentsUpload] = useState({});
  const [documentsJustification, setDocumentsJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [showMontagemModal, setShowMontagemModal] = useState(false);
  const [montagemProgramacao, setMontagemProgramacao] = useState(null);
  const [montagemSubmitting, setMontagemSubmitting] = useState(false);
  const [montagemComprovante, setMontagemComprovante] = useState(null);
  const montagemComprovanteRef = useRef(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnProof, setReturnProof] = useState(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const [showContainerReturnModal, setShowContainerReturnModal] = useState(false);
  const [currentProgramacaoForReturn, setCurrentProgramacaoForReturn] = useState(null);
  const [containerVazioProof, setContainerVazioProof] = useState(null);
  const [containerVazioSubmitting, setContainerVazioSubmitting] = useState(false);
  const containerVazioProofRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [sortBy, setSortBy] = useState('data');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => { loadProgramacoes(); }, [user]);

  useEffect(() => {
    if (!programacoes || programacoes.length === 0) return;
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const step = params.get('step');
    const pending = params.get('pending');
    if (pending) setFromPendingNav(true);
    if (!q) return;
    const needle = String(q).trim().toUpperCase();
    const found = programacoes.find(p => String(p.processo || p.container || '').toUpperCase().includes(needle));
    if (found) {
      handleStartDelivery(found).catch(() => {});
      if (step === 'finalDocs') {
        goToStep('finalDocs');
        if (pending) setToast({ message: `Pendência de documento: ${pending}`, type: 'warning' });
      }
    }
  }, [programacoes, location.search]);

  const loadProgramacoes = async () => {
    setLoading(true);
    try {
      const res = await adminService.getProgramacoes();
      const todas = res.data.programacoes || [];
      setAllProgramacoes(todas);
      let nomeFiltro = '';
      if (user) nomeFiltro = (user.username || user.name || '').trim().toUpperCase();
      let filtradas = [];
      if (nomeFiltro) filtradas = todas.filter(p => String(p.contratado).trim().toUpperCase() === nomeFiltro);
      
      const deliveriesRes = await deliveryService.getMyDeliveries({});
      const deliveries = deliveriesRes.data.deliveries || [];
      const map = {};
      const programacaoMap = {};
      deliveries.forEach(d => {
        map[(d.deliveryNumber || '').toUpperCase()] = d;
        if (d.programacaoId) programacaoMap[String(d.programacaoId)] = d;
      });
      setDeliveriesMap(map);
      
      // Remover apenas programações canceladas ou que já tiveram o container vazio devolvido
      const visibleProgramacoes = filtradas.filter(p => {
        const status = String(p.status || '').toUpperCase();
        if (['CANCELADO'].includes(status)) return false;

        // Se marcada como containerReturned, não mostra
        if (p.containerReturned === true) return false;

        // Se o delivery indexado por programacaoId já tem comprovante, não mostra
        const byProg = programacaoMap[String(p._id)];
        if (byProg && byProg.documents && (byProg.documents.devolucaoVazio || byProg.documents.devolucaoContainerVazio) && ((byProg.documents.devolucaoVazio && byProg.documents.devolucaoVazio.length > 0) || (byProg.documents.devolucaoContainerVazio && byProg.documents.devolucaoContainerVazio.length > 0))) {
          return false;
        }
        // also hide if delivery has observation marker (in case document upload failed)
        if (byProg && byProg.observations && byProg.observations.includes('(CONTAINER_VAZIO_DEVOLVIDO)')) {
          return false;
        }

        // Tentar buscar o delivery por linkedDeliveryId primeiro
        if (p.linkedDeliveryId) {
          const del = deliveries.find(d => d._id === p.linkedDeliveryId);
          if (del && del.documents && ((del.documents.devolucaoVazio && del.documents.devolucaoVazio.length > 0) || (del.documents.devolucaoContainerVazio && del.documents.devolucaoContainerVazio.length > 0))) {
            return false;
          }
        }

        // Fallback: buscar por container/processo
        const key = ((p.container || p.processo || '').toUpperCase());
        const del = map[key];
        if (del && del.documents && ((del.documents.devolucaoVazio && del.documents.devolucaoVazio.length > 0) || (del.documents.devolucaoContainerVazio && del.documents.devolucaoContainerVazio.length > 0))) {
          return false;
        }

        return true;
      });
      setProgramacoes(visibleProgramacoes);
      setToast(null);
    } catch (err) {
      setToast({ message: 'Erro ao carregar entregas programadas', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
    }
  };;

  const handleStartDelivery = async (p) => {
    const deliveryNumber = (p.container && p.container.trim()) || (p.processo && p.processo.trim());
    if (!deliveryNumber) { setToast({ message: 'Sem número de container/processo', type: 'error' }); return; }
    try {
      setSubmitting(true);
      let existing = null;
      try {
        const searchRes = await deliveryService.getMyDeliveries({ q: deliveryNumber.toUpperCase() });
        const list = searchRes.data.deliveries || [];
        existing = list.find(d => String(d.deliveryNumber).toUpperCase() === deliveryNumber.toUpperCase());
      } catch (_) {}

      if (existing) {
        setCurrentDelivery(existing);
        setCurrentProgramacao(p);
        if (existing.status === 'CONTAINER_MONTADO') {
          await deliveryService.updateDelivery(existing._id, { status: 'A_CAMINHO_DO_CLIENTE' });
          existing.status = 'A_CAMINHO_DO_CLIENTE';
          p.status = 'A_CAMINHO_DO_CLIENTE';
        }
        let restoredStep = 'welcome';
        switch ((existing.status || '').toUpperCase()) {
          case 'AGUARDANDO_DESOVA': restoredStep = 'confirmDesova'; break;
          case 'EM_DESOVA': restoredStep = 'desovaProgress'; break;
          case 'AGUARDANDO_ANEXO': case 'ANEXANDO_DOCUMENTOS_FINAIS': restoredStep = 'finalDocs'; break;
          case 'AGUARDANDO_AGENDAMENTO_DEVOLUCAO': restoredStep = 'askSchedule'; break;
          case 'ENTREGUE': case 'DEVOLVENDO_CONTAINER': case 'FINALIZADO': restoredStep = 'welcome'; break;
          default: restoredStep = 'welcome';
        }
        setCurrentStep(existing.currentStep || restoredStep);
        setPhotos([]); setObservations(''); setJustification(''); setDocumentsUpload({});
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
        setPhotos([]); setObservations(''); setJustification(''); setDocumentsUpload({});
        setShowModal(true);
        await loadProgramacoes();
      }
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Erro ao iniciar entrega', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false); setCurrentStep('welcome'); setCurrentDelivery(null); setCurrentProgramacao(null);
    setPhotos([]); setObservations(''); setJustification(''); setDocumentsUpload({}); setDocumentsJustification('');
    loadProgramacoes();
  };

  const handleStartMontagem = async (p) => { setMontagemProgramacao(p); setShowMontagemModal(true); };

  const openReturnModal = (p) => { setCurrentProgramacao(p); setReturnProof(null); setShowReturnModal(true); };
  const closeReturnModal = () => { setShowReturnModal(false); setReturnProof(null); setCurrentProgramacao(null); };

  const handleReturn = async () => {
    if (!currentProgramacao) return;
    setReturnSubmitting(true);
    try {
      const isPendingCanhoto = Array.isArray(currentProgramacao.missingDocumentsAtSubmit) && currentProgramacao.missingDocumentsAtSubmit.length > 0;
      if (currentProgramacao.linkedDeliveryId) {
        if (!isPendingCanhoto) await deliveryService.updateDelivery(currentProgramacao.linkedDeliveryId, { status: 'FINALIZADO' });
        if (returnProof) await deliveryService.uploadDocument(currentProgramacao.linkedDeliveryId, 'devolucaoVazio', returnProof);
      } else {
        const searchVal = (currentProgramacao.container || currentProgramacao.processo || '').trim();
        if (searchVal) {
          const resp = await deliveryService.getMyDeliveries({ searchTerm: searchVal });
          const found = resp.data.deliveries && resp.data.deliveries[0];
          if (found) {
            if (!isPendingCanhoto) await deliveryService.updateDelivery(found._id, { status: 'FINALIZADO' });
            if (returnProof) await deliveryService.uploadDocument(found._id, 'devolucaoVazio', returnProof);
          }
        }
      }
      try { if (!isPendingCanhoto) await adminService.updateProgramacao(currentProgramacao._id, { status: 'FINALIZADO' }); } catch (_) {}
      setToast({ message: 'Devolução vazia registrada!', type: 'success' });
      await loadProgramacoes();
      closeReturnModal();
    } catch (err) {
      setToast({ message: 'Erro ao fazer devolução', type: 'error' });
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleMontagemFinished = async (finished) => {
    if (!finished) return;
    if (!montagemComprovante) { setToast({ message: 'Anexe o comprovante da montagem', type: 'error' }); return; }
    try {
      setMontagemSubmitting(true);
      const deliveryNumber = (montagemProgramacao.container && montagemProgramacao.container.trim()) ||
        (montagemProgramacao.processo && montagemProgramacao.processo.trim());
      if (!deliveryNumber) { setToast({ message: 'Sem número de container/processo', type: 'error' }); setShowMontagemModal(false); setMontagemProgramacao(null); return; }
      const payload = {
        deliveryNumber: deliveryNumber.toUpperCase(),
        observations: `Montagem finalizada em ${new Date().toLocaleString('pt-BR')}`,
        driverName: montagemProgramacao.motorista || user?.fullName || user?.name || '',
        containerMontadoAt: new Date().toISOString(),
        status: 'CONTAINER_MONTADO'
      };
      const res = await deliveryService.createDelivery(payload);
      const delivery = res.data.delivery;
      try { await deliveryService.uploadDocument(delivery._id, 'retiradaCheio', montagemComprovante); } catch (_) {}
      await deliveryService.updateDelivery(delivery._id, { status: 'CONTAINER_MONTADO' });
      setToast({ message: 'Container montado com sucesso!', type: 'success' });
      setShowMontagemModal(false); setMontagemProgramacao(null); setMontagemComprovante(null);
      loadProgramacoes();
    } catch (err) {
      setToast({ message: err?.response?.data?.message || 'Erro ao marcar montagem', type: 'error' });
    } finally {
      setMontagemSubmitting(false);
    }
  };

  const closeMontagemModal = () => { setShowMontagemModal(false); setMontagemProgramacao(null); };

  const goToStep = async (step) => {
    setPhotos([]);
    setCurrentStep(step);
    try {
      if (currentDelivery && currentDelivery._id) {
        await deliveryService.updateDelivery(currentDelivery._id, { currentStep: step });
        const refreshed = await deliveryService.getDelivery(currentDelivery._id);
        setCurrentDelivery(refreshed.data.delivery);
      }
    } catch (_) {}
  };

  const addPhoto = (photo) => setPhotos(prev => [...prev, photo]);
  const removePhoto = (index) => setPhotos(prev => prev.filter((_, i) => i !== index));

  const handleCameraCapture = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    let filesProcessed = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const data = ev.target?.result;
        if (data) addPhoto(data);
        filesProcessed++;
        if (filesProcessed === files.length) {
          // reset input only after all files processed
          try { e.target.value = null; } catch(_) {}
        }
      };
      reader.readAsDataURL(file);
    });
  };

  function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
    return new File([u8arr], filename, { type: mime });
  }

  const compressAndUpload = async (docKey, status, nextStep, timestamps = {}) => {
    if (!photos || photos.length === 0) { setToast({ message: 'Tire ao menos uma foto', type: 'error' }); return; }
    setSubmitting(true); setUploadProgress(0);
    try {
      const compressedFiles = [];
      for (let i = 0; i < photos.length; i++) {
        const file = dataURLtoFile(photos[i], `foto_${i}.jpg`);
        const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
        compressedFiles.push(compressed);
        setUploadProgress(Math.round(((i + 1) / photos.length) * 60));
      }
      await deliveryService.uploadDocument(currentDelivery._id, docKey, compressedFiles);
      setUploadProgress(100);
      await deliveryService.updateDelivery(currentDelivery._id, { status, currentStep: nextStep, ...timestamps });
      goToStep(nextStep);
      loadProgramacoes();
    } catch (err) {
      setToast({ message: 'Erro ao enviar fotos', type: 'error' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleObservationSubmit = async () => {
    if (!observations.trim()) { setToast({ message: 'Informe a observação', type: 'error' }); return; }
    try {
      const fresh = await deliveryService.getDelivery(currentDelivery._id);
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      await deliveryService.updateDelivery(currentDelivery._id, { observations: `${existingObs ? existingObs + '\n' : ''}[${timestamp}] ${observations}` });
      setToast({ message: 'Observação registrada', type: 'success' });
      goToStep('welcome');
    } catch (_) { setToast({ message: 'Erro ao salvar observação', type: 'error' }); }
  };

  const handleJustificationSubmit = async () => {
    if (!justification.trim()) { setToast({ message: 'Informe a justificativa', type: 'error' }); return; }
    try {
      await deliveryService.updateDelivery(currentDelivery._id, { observations: `(DESOVA NÃO INICIADA) ${justification}` });
      setToast({ message: 'Justificativa enviada', type: 'success' });
      goToStep('confirmDesova');
    } catch (_) { setToast({ message: 'Erro ao enviar justificativa', type: 'error' }); }
  };

  const handleScheduleDecision = async (shouldSchedule) => {
    if (shouldSchedule) {
      try {
        const fresh = await deliveryService.getDelivery(currentDelivery._id);
        const existingObs = fresh.data.delivery.observations || '';
        const timestamp = new Date().toLocaleString('pt-BR');
        const obs = `(SOLICITACAO_AGENDAMENTO) Motorista solicitou agendamento de devolução do container.`;
        await deliveryService.updateDelivery(currentDelivery._id, { observations: `${existingObs ? existingObs + '\n' : ''}[${timestamp}] ${obs}` });
        setToast({ message: 'Solicitação enviada ao admin', type: 'success' });
      } catch (_) { setToast({ message: 'Erro ao enviar solicitação', type: 'error' }); }
    }
    await deliveryService.updateDelivery(currentDelivery._id, { status: 'ANEXANDO_DOCUMENTOS_FINAIS', currentStep: 'finalDocs' });
    if (currentProgramacao) currentProgramacao.status = 'ANEXANDO_DOCUMENTOS_FINAIS';
    await loadProgramacoes();
    goToStep('finalDocs');
  };

  const handleFinalUploadAndSubmit = async () => {
    const requiredDocs = ['canhotCTE', 'diarioBordo', 'canhotNF'];
    // list missing so we can pass observation when forcing submit
    const missing = requiredDocs.filter(k => !(documentsUpload[k] && documentsUpload[k].length > 0));
    const allOk = missing.length === 0;
    if (!allOk && !documentsJustification.trim()) {
      setToast({ message: 'Anexe todos os documentos ou justifique', type: 'error' }); return;
    }
    setSubmitting(true);
    try {
      // upload any new docs
      for (const docType of requiredDocs) {
        if (documentsUpload[docType] && documentsUpload[docType].length > 0) {
          await deliveryService.uploadDocument(currentDelivery._id, docType, documentsUpload[docType]);
        }
      }

      // submit the delivery so the backend records missingDocumentsAtSubmit (if any)
      if (allOk) {
        await deliveryService.submitDelivery(currentDelivery._id);
      } else {
        await deliveryService.submitDelivery(currentDelivery._id, { force: true, observation: documentsJustification });
      }

      // update delivery to finalizado (backend tracking), but keep programacao as ENTREGUE
      await deliveryService.updateDelivery(currentDelivery._id, { status: 'FINALIZADO' });
      try {
        await adminService.updateProgramacao(currentProgramacao._id, { status: 'ENTREGUE' });
        // reflect immediately in UI
        currentProgramacao.status = 'ENTREGUE';
      } catch (_) {}

      const fresh = await deliveryService.getDelivery(currentDelivery._id);
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      const docsObs = documentsJustification ? `(JUSTIFICATIVA_DOCS) ${documentsJustification}` : '';
      const newObs = `${existingObs ? existingObs + '\n' : ''}${docsObs ? `[${timestamp}] ${docsObs}` : ''}`;
      // ensure observation stored as well
      await deliveryService.updateDelivery(currentDelivery._id, { observations: newObs });

      setToast({ message: 'Documentos enviados! Agora faça a devolução do container vazio.', type: 'success' });
      await loadProgramacoes();
      closeModal();
    } catch (err) {
      setToast({ message: 'Erro ao enviar documentos', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContainerReturn = async () => {
    if (!currentProgramacaoForReturn) return;
    setContainerVazioSubmitting(true);
    try {
      if (!containerVazioProof) {
        setToast({ message: 'Anexe o comprovante de devolução do container vazio', type: 'error' });
        setContainerVazioSubmitting(false);
        return;
      }
      const deliveryNumber = (currentProgramacaoForReturn.container && currentProgramacaoForReturn.container.trim()) || (currentProgramacaoForReturn.processo && currentProgramacaoForReturn.processo.trim());
      let deliveryId = currentProgramacaoForReturn.linkedDeliveryId;
      if (!deliveryId && deliveryNumber) {
        const resp = await deliveryService.getMyDeliveries({ searchTerm: deliveryNumber });
        const found = resp.data.deliveries && resp.data.deliveries[0];
        if (found) deliveryId = found._id;
      }
      if (!deliveryId) {
        setToast({ message: 'Entrega não encontrada', type: 'error' });
        setContainerVazioSubmitting(false);
        return;
      }
      if (containerVazioProof) {
        try {
          // write using the canonical key expected by tower UI
          await deliveryService.uploadDocument(deliveryId, 'devolucaoVazio', containerVazioProof);
        } catch (uploadErr) {
          console.error('Erro ao fazer upload:', uploadErr);
          setToast({ message: 'Erro ao fazer upload do comprovante: ' + (uploadErr?.response?.data?.message || uploadErr.message), type: 'error' });
          setContainerVazioSubmitting(false);
          return;
        }
      }
      const fresh = await deliveryService.getDelivery(deliveryId);
      const currentStatus = fresh.data.delivery.status || '';
      // pendência status obsolete – always finalize normally
      const finalStatus = 'FINALIZADO';
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      const containerObs = `[${timestamp}] (CONTAINER_VAZIO_DEVOLVIDO) Container vazio devolvido com comprovante.`;
      const newObs = `${existingObs ? existingObs + '\n' : ''}${containerObs}`;
      const horarioDevolucaoVazio = new Date().toISOString();
      
      // Atualizar entrega com horário de devolução (backend marcará containerReturned na programação)
      await deliveryService.updateDelivery(deliveryId, { 
        status: finalStatus, 
        observations: newObs, 
        horarioDevolucaoVazio,
        programacaoId: currentProgramacaoForReturn._id 
      });

      const msg = finalStatus === 'FINALIZADO' ? 'Entrega finalizada com sucesso!' : 'Container devolvido. Canhoto pendente!';
      setToast({ message: msg, type: 'success' });
      console.log('[CONTAINER_RETURN] Devolução confirmada. Disparando event programacoesUpdated');
      
      // Remove local programação immediately so it disappears from Programadas
      setProgramacoes(prev => prev.filter(p => p._id !== currentProgramacaoForReturn._id));
      // notify other screens that programacoes data changed (e.g. kanban)
      window.dispatchEvent(new Event('programacoesUpdated'));
      setShowContainerReturnModal(false);
      setCurrentProgramacaoForReturn(null);
      setContainerVazioProof(null);
    } catch (err) {
      setToast({ message: 'Erro ao registrar devolução do container vazio', type: 'error' });
    } finally {
      setContainerVazioSubmitting(false);
    }
  };

  const openContainerReturnModal = (p) => {
    setCurrentProgramacaoForReturn(p);
    setContainerVazioProof(null);
    setShowContainerReturnModal(true);
  };

  const closeContainerReturnModal = () => {
    setShowContainerReturnModal(false);
    setCurrentProgramacaoForReturn(null);
    setContainerVazioProof(null);
  };

  const getFilteredAndSorted = () => {
    let result = programacoes;
    if (searchTerm.trim()) {
      const needle = searchTerm.toUpperCase();
      result = result.filter(p => String(p.processo || '').toUpperCase().includes(needle) || String(p.container || '').toUpperCase().includes(needle) || String(p.recebedor || '').toUpperCase().includes(needle));
    }
    if (statusFilter !== 'all') result = result.filter(p => (p.status || 'pending').toUpperCase() === statusFilter.toUpperCase());
    if (driverFilter !== 'all') result = result.filter(p => String(p.motorista || '').trim().toUpperCase() === driverFilter.toUpperCase());
    result = [...result].sort((a, b) => {
      let aVal = sortBy === 'data' ? new Date(a.dataAgendamento || 0).getTime() : String(a.container || '').length;
      let bVal = sortBy === 'data' ? new Date(b.dataAgendamento || 0).getTime() : String(b.container || '').length;
      return sortOrder === 'desc' ? (bVal - aVal || String(bVal).localeCompare(String(aVal))) : (aVal - bVal || String(aVal).localeCompare(String(bVal)));
    });
    return result;
  };

  // Agrupamento por container para entregas fracionadas
  const filteredProgramacoesRaw = getFilteredAndSorted();
  // Agrupa programacoes por container
  const groupedByContainer = {};
  filteredProgramacoesRaw.forEach(p => {
    const key = (p.container || p.processo || '').toUpperCase();
    if (!groupedByContainer[key]) groupedByContainer[key] = [];
    groupedByContainer[key].push(p);
  });

  // Para cada grupo, mostra apenas uma montagem/devolução, mas lista todos os recebedores/processos
  // Função para determinar o status mais avançado
  function getMostAdvancedStatus(group) {
    const statusOrder = [
      'FINALIZADO',
      'DEVOLVENDO_CONTAINER',
      'ENTREGUE',
      'ANEXANDO_DOCUMENTOS_FINAIS',
      'AGUARDANDO_AGENDAMENTO_DEVOLUCAO',
      'DESOVA_FINALIZADA',
      'EM_DESOVA',
      'AGUARDANDO_DESOVA',
      'A_CAMINHO_DO_CLIENTE',
      'CONTAINER_MONTADO',
      'AGENDADO',
      'PENDING',
      'pending'
    ];
    for (const status of statusOrder) {
      const found = group.find(p => (p.status || '').toUpperCase() === status);
      if (found) return found;
    }
    return group[0];
  }

  const filteredProgramacoes = Object.values(groupedByContainer).map(group => {
    // Seleciona a programação com status mais avançado
    const main = getMostAdvancedStatus(group);
    // Adiciona todos os recebedores/processos ao card
    main.fracionadas = group;
    return main;
  });

  // Botão de ação principal para cada programação
  const renderActionButton = (p) => {
    const s = (p.status || 'pending').toUpperCase();
    if (!p.status || s === 'PENDING' || s === 'AGENDADO') {
      return (
        <button onClick={() => handleStartMontagem(p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg active:scale-95 transition font-bold text-sm"
        >
          <FaWarehouse size={14} /> Iniciar Montagem
        </button>
      );
    }
    if (s === 'CONTAINER_MONTADO') {
      return (
        <button onClick={() => handleStartDelivery(p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl shadow-md hover:shadow-lg active:scale-95 transition font-bold text-sm"
        >
          <FaTruck size={14} /> Iniciar Entrega
        </button>
      );
    }
    if (['ENTREGUE', 'DEVOLVENDO_CONTAINER', 'FINALIZADO'].includes(s)) {
      return (
        <button onClick={() => openContainerReturnModal(p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl shadow-md hover:shadow-lg active:scale-95 transition font-bold text-sm"
        >
          <FaTruck size={14} /> Devolver Container Vazio
        </button>
      );
    }
    if (p.status && !['AGENDADO', 'CONTAINER_MONTADO', 'ENTREGUE', 'DEVOLVENDO_CONTAINER', 'CANCELADO', 'FINALIZADO', 'pending'].includes(s)) {
      return (
        <button onClick={() => handleStartDelivery(p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl shadow-md hover:shadow-lg active:scale-95 transition font-bold text-sm"
        >
          <FaChevronRight size={14} /> Continuar
        </button>
      );
    }
    return null;
  };

  // ─────────────────────────────────────────────
  //  CAMERA/PHOTO SECTION REUSABLE
  // ─────────────────────────────────────────────
  const PhotoSection = ({ onConfirm, onBack, buttonLabel = 'Enviar registro', buttonColor = 'bg-emerald-600 hover:bg-emerald-700' }) => (
    <div className="space-y-4">
      {uploadProgress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-gray-600">
            <span>Enviando fotos...</span><span>{Math.round(uploadProgress)}%</span>
          </div>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}
      <PhotoGrid photos={photos} onRemove={removePhoto} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" />
      <button
        onClick={() => {
          if (cameraInputRef.current) cameraInputRef.current.value = null;
          cameraInputRef.current?.click();
        }}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-base shadow-lg hover:shadow-xl active:scale-95 transition"
      >
        <FaCamera size={18} />
        {photos.length === 0 ? 'Tirar Foto' : 'Tirar Mais Fotos'}
      </button>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={submitting || photos.length === 0}
          className={`flex-1 py-3.5 rounded-xl text-white font-bold text-base shadow-md active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed ${buttonColor}`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Enviando...
            </span>
          ) : buttonLabel}
        </button>
        <button onClick={onBack} className="flex-1 py-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base active:scale-95 transition">
          Voltar
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)' }}>

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-white/5 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-white/80 hover:text-white font-semibold transition"
          >
            <FaArrowLeft size={14} />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
              <FaTruck className="text-white" size={14} />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-base leading-tight">Entregas Programadas</h1>
              <p className="text-white/50 text-xs">{filteredProgramacoes.length} entrega(s)</p>
            </div>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-4">

        {/* ── SEARCH & FILTERS ── */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 space-y-3">
          {/* Search input */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            <input
              type="text"
              placeholder="Buscar processo, container, recebedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            />
          </div>
          {/* Filter row */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={driverFilter}
              onChange={e => setDriverFilter(e.target.value)}
              className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm appearance-none"
            >
              <option value="all" className="bg-gray-900">Todos os motoristas</option>
              {programacoes && [...new Set(programacoes.map(p => p.motorista).filter(Boolean))].sort().map(driver => (
                <option key={driver} value={driver} className="bg-gray-900">{driver}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm appearance-none"
            >
              <option value="all" className="bg-gray-900">Todos os status</option>
              <option value="pending" className="bg-gray-900">Agendado</option>
              <option value="CONTAINER_MONTADO" className="bg-gray-900">Container Montado</option>
              <option value="A_CAMINHO_DO_CLIENTE" className="bg-gray-900">A Caminho</option>
              <option value="ENTREGUE" className="bg-gray-900">Entregue</option>
              <option value="DEVOLVENDO_CONTAINER" className="bg-gray-900">Devolvendo Container</option>
              <option value="FINALIZADO" className="bg-gray-900">Pendente Devolução</option>
            </select>
            <div className="flex gap-1.5">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none text-sm appearance-none"
              >
                <option value="data" className="bg-gray-900">Por data</option>
                <option value="tamanho" className="bg-gray-900">Tamanho</option>
              </select>
              <button
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-base hover:bg-white/20 transition"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>

        {/* ── DELIVERY CARDS ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-emerald-400 animate-spin" />
              <FaTruck className="absolute inset-0 m-auto text-white/60" size={22} />
            </div>
            <p className="text-white/60 font-medium">Carregando entregas...</p>
          </div>
        ) : filteredProgramacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <MdLocalShipping className="text-white/40" size={40} />
            </div>
            <p className="text-white/60 text-lg font-semibold">Nenhuma entrega encontrada</p>
            <p className="text-white/40 text-sm">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProgramacoes.map((p) => (
              <div key={p._id}
                className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-200"
              >
                {/* Card top color bar */}
                <div className={`h-1.5 w-full ${
                  (!p.status || p.status === 'pending' || p.status === 'PENDING') ? 'bg-gradient-to-r from-sky-400 to-blue-500' :
                  p.status === 'CONTAINER_MONTADO' ? 'bg-gradient-to-r from-indigo-400 to-purple-500' :
                  p.status === 'A_CAMINHO_DO_CLIENTE' ? 'bg-gradient-to-r from-purple-400 to-pink-500' :
                  p.status === 'AGUARDANDO_DESOVA' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                  p.status === 'EM_DESOVA' ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                  p.status === 'ENTREGUE' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                  p.status === 'DEVOLVENDO_CONTAINER' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                  p.status === 'FINALIZADO' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                  'bg-gradient-to-r from-gray-300 to-gray-400'
                }`} />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Container</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-gray-900 leading-tight">{p.container || p.processo || '-'}</h3>
                    </div>
                    <StatusBadge status={p.status} containerReturned={p.containerReturned} />
                  </div>

                  {/* Info grid: mostra todos os recebedores/processos do grupo */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <FaUser size={10} className="text-purple-500" />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase">Recebedores</span>
                      </div>
                      <ul className="font-bold text-purple-700 text-sm leading-tight">
                        {p.fracionadas && p.fracionadas.map(f => (
                          <li key={f._id}>{f.recebedor || '-'}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <FaCalendarAlt size={10} className="text-emerald-500" />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase">Agendamentos</span>
                      </div>
                      <ul className="font-bold text-gray-800 text-sm leading-tight">
                        {p.fracionadas && p.fracionadas.map(f => (
                          <li key={f._id}>{f.dataAgendamento ? new Date(f.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <FaTruck size={10} className="text-emerald-500" />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase">Motoristas</span>
                      </div>
                      <ul className="font-bold text-emerald-700 text-sm leading-tight">
                        {p.fracionadas && p.fracionadas.map(f => (
                          <li key={f._id}>{f.motorista || '-'}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="flex justify-end">
                    {renderActionButton(p)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TOAST ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ════════════════════════════════════════════
           MODAL: DEVOLUÇÃO VAZIA
          ════════════════════════════════════════════ */}
      {showReturnModal && currentProgramacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FaRoute className="text-white" size={18} />
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-extrabold">Devolução de Vazio</h2>
                    <p className="text-white/70 text-sm">{currentProgramacao.processo}</p>
                  </div>
                </div>
                <button onClick={closeReturnModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-gray-600 text-sm">Anexe o comprovante de devolução para concluir o processo.</p>

              <div className={`rounded-2xl border-2 p-4 transition-all ${returnProof ? 'border-pink-400 bg-pink-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FaImage className="text-pink-500" size={18} />
                  <p className="font-bold text-gray-800 text-sm">Comprovante de Devolução</p>
                </div>
                {returnProof ? (
                  <div className="flex items-center justify-between bg-pink-100 rounded-xl px-3 py-2 mb-3">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="text-pink-500" size={14} />
                      <span className="text-xs font-bold text-pink-700 truncate max-w-[150px]">{returnProof.name}</span>
                    </div>
                    <button onClick={() => setReturnProof(null)} className="text-red-500 hover:text-red-700">
                      <FaTimes size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3 text-center">Nenhuma foto selecionada</p>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <FaCamera size={14} /> {returnProof ? 'Trocar Foto' : 'Selecionar Foto'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) setReturnProof(f); }} className="hidden" />
              </div>

              {returnSubmitting && (
                <div className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-300 rounded-xl">
                  <svg className="animate-spin h-5 w-5 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-pink-700 font-semibold text-sm">Processando devolução...</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleReturn}
                  disabled={returnSubmitting || !returnProof}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold text-base shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✅ Enviar Devolução
                </button>
                <button onClick={closeReturnModal} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-base active:scale-95 transition">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           MODAL: MONTAGEM DE CONTAINER
          ════════════════════════════════════════════ */}
      {showMontagemModal && montagemProgramacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FaWarehouse className="text-white" size={18} />
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-extrabold">Montagem de Container</h2>
                    <p className="text-white/70 text-sm">{montagemProgramacao.processo}</p>
                  </div>
                </div>
                <button onClick={closeMontagemModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Info card */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Container', value: montagemProgramacao.container || '-', icon: FaBox, color: 'text-blue-500' },
                  { label: 'Recebedor', value: montagemProgramacao.recebedor || '-', icon: FaUser, color: 'text-purple-500' },
                  { label: 'Motorista', value: montagemProgramacao.motorista || '-', icon: FaTruck, color: 'text-emerald-500' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <item.icon className={`mx-auto mb-1 ${item.color}`} size={14} />
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">{item.label}</p>
                    <p className="text-xs font-bold text-gray-800 leading-tight truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Comprovante upload */}
              <div className={`rounded-2xl border-2 p-4 transition-all ${montagemComprovante ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FaImage className="text-blue-500" size={18} />
                  <p className="font-bold text-gray-800 text-sm">Comprovante de Montagem</p>
                </div>
                {montagemComprovante ? (
                  <div className="flex items-center justify-between bg-blue-100 rounded-xl px-3 py-2 mb-3">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="text-blue-500" size={14} />
                      <span className="text-xs font-bold text-blue-700 truncate max-w-[180px]">{montagemComprovante.name}</span>
                    </div>
                    <button onClick={() => setMontagemComprovante(null)} className="text-red-500 hover:text-red-700">
                      <FaTimes size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3 text-center">Nenhuma foto selecionada</p>
                )}
                <button
                  onClick={() => montagemComprovanteRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <FaCamera size={14} /> {montagemComprovante ? 'Trocar Foto' : 'Tirar Foto'}
                </button>
                <input ref={montagemComprovanteRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) setMontagemComprovante(f); }} className="hidden" />
              </div>

              {montagemSubmitting && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-300 rounded-xl">
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-blue-700 font-semibold text-sm">Registrando montagem...</span>
                </div>
              )}

              <button
                onClick={() => handleMontagemFinished(true)}
                disabled={montagemSubmitting || !montagemComprovante}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✅ Confirmar Container Montado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           MODAL: DEVOLUÇÃO CONTAINER VAZIO
          ════════════════════════════════════════════ */}
      {showContainerReturnModal && currentProgramacaoForReturn && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FaTruck className="text-white" size={18} />
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-extrabold">Devolução Container Vazio</h2>
                    <p className="text-white/70 text-sm">{currentProgramacaoForReturn.processo}</p>
                  </div>
                </div>
                <button onClick={closeContainerReturnModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-gray-600 text-sm">Anexe o comprovante de devolução do container vazio para finalizar o processo.</p>

              <div className={`rounded-2xl border-2 p-4 transition-all ${containerVazioProof ? 'border-yellow-400 bg-yellow-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FaImage className="text-yellow-500" size={18} />
                  <p className="font-bold text-gray-800 text-sm">Comprovante de Devolução</p>
                </div>
                {containerVazioProof ? (
                  <div className="flex items-center justify-between bg-yellow-100 rounded-xl px-3 py-2 mb-3">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="text-yellow-500" size={14} />
                      <span className="text-xs font-bold text-yellow-700 truncate max-w-[150px]">{containerVazioProof.name}</span>
                    </div>
                    <button onClick={() => setContainerVazioProof(null)} className="text-red-500 hover:text-red-700">
                      <FaTimes size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3 text-center">Nenhuma foto selecionada</p>
                )}
                <button
                  onClick={() => containerVazioProofRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <FaCamera size={14} /> {containerVazioProof ? 'Trocar Foto' : 'Tirar Foto'}
                </button>
                <input ref={containerVazioProofRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) setContainerVazioProof(f); }} className="hidden" />
              </div>

              {containerVazioSubmitting && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-300 rounded-xl">
                  <svg className="animate-spin h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-yellow-700 font-semibold text-sm">Registrando devolução...</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleContainerReturn}
                  disabled={containerVazioSubmitting || !containerVazioProof}
                  className="flex-1 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl font-bold text-base shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✅ Confirmar Devolução
                </button>
                <button onClick={closeContainerReturnModal} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-base active:scale-95 transition">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           MODAL: FLUXO DE ENTREGA
          ════════════════════════════════════════════ */}
      {showModal && currentDelivery && currentProgramacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full h-full sm:max-w-xl sm:rounded-3xl sm:h-auto rounded-none shadow-2xl overflow-hidden flex flex-col">

            {/* Modal header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <MdLocalShipping className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-white text-lg font-extrabold leading-tight">Fluxo de Entrega</h2>
                    <p className="text-white/70 text-xs">{currentProgramacao.processo} · {currentProgramacao.recebedor}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
              <FlowStepBar currentStep={currentStep} />
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5">

              {/* ── STEP: welcome ── */}
              {currentStep === 'welcome' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FaUser className="text-blue-600" size={16} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Motorista</p>
                        <p className="font-bold text-gray-900">{currentProgramacao?.motorista || currentDelivery?.driverName || user?.fullName || 'Motorista'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <FaMapMarkerAlt className="text-purple-600" size={16} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Destino</p>
                        <p className="font-bold text-gray-900">{currentProgramacao?.recebedor || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <FaCalendarAlt className="text-emerald-600" size={16} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Data agendada</p>
                        <p className="font-bold text-blue-700 text-base">
                          {new Date(currentProgramacao?.dataAgendamento).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                    {(currentDelivery && ['pending', 'PENDING', 'EM_ROTA'].includes((currentDelivery.status || ''))) && (
                      <div className="pt-1 space-y-2">
                        <ProgressiveTruck start={currentDelivery.createdAt} />
                        <div className="flex justify-between text-xs text-gray-500 px-1">
                          <span>Origem</span>
                          <span className="font-bold text-blue-600">
                            <ElapsedTimer start={currentDelivery.createdAt} />
                          </span>
                          <span>Destino</span>
                        </div>
                      </div>
                    )}
                    <StepTimer start={currentDelivery?.createdAt || currentProgramacao?.dataAgendamento} label="Tempo total" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => goToStep('arrival')}
                      className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-base shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      <FaMapMarkerAlt size={16} /> Cheguei no cliente
                    </button>
                    <button onClick={() => goToStep('obs')}
                      className="px-4 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      <FaClipboardList size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: obs ── */}
              {currentStep === 'obs' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                      <FaClipboardList className="text-blue-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Observação</h3>
                  </div>
                  <StepTimer start={currentDelivery?.createdAt} label="Tempo em rota" />
                  <textarea
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none text-gray-800 placeholder-gray-400"
                    rows={5}
                    placeholder="Descreva sua observação aqui..."
                  />
                  <div className="flex gap-3">
                    <button onClick={handleObservationSubmit} disabled={submitting}
                      className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base active:scale-95 transition disabled:opacity-50">
                      Enviar
                    </button>
                    <button onClick={() => goToStep('welcome')}
                      className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-base active:scale-95 transition">
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: arrival ── */}
              {currentStep === 'arrival' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                      <FaCamera className="text-purple-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Registre sua chegada</h3>
                  </div>
                  <StepTimer start={currentDelivery?.createdAt} label="Tempo em rota" />
                  <p className="text-gray-500 text-sm">Tire uma ou mais fotos do local de entrega</p>
                  <PhotoSection
                    onConfirm={() => compressAndUpload('chegadaCliente', 'AGUARDANDO_DESOVA', 'confirmDesova', { arrivedAt: new Date().toISOString() })}
                    onBack={() => goToStep('welcome')}
                    buttonLabel="✓ Confirmar chegada"
                    buttonColor="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  />
                </div>
              )}

              {/* ── STEP: confirmDesova ── */}
              {currentStep === 'confirmDesova' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                      <FaWarehouse className="text-orange-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Confirme a Desova</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Aguardando desova" />
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-amber-800 font-semibold text-sm mb-1">📦 Desova iniciada?</p>
                    <p className="text-gray-600 text-sm">Indique se a descarga do container foi iniciada ou não</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => goToStep('desovaStart')}
                      className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                      ✓ Desova iniciada
                    </button>
                    <button onClick={() => goToStep('desovaJustify')}
                      className="flex-1 py-4 bg-gradient-to-r from-red-400 to-rose-500 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                      ✗ Não iniciada
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: desovaJustify ── */}
              {currentStep === 'desovaJustify' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                      <FaExclamationTriangle className="text-red-500" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Justificativa</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo aguardando" />
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-800 text-sm font-medium">Por que a desova não foi iniciada?</p>
                  </div>
                  <textarea
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none text-gray-800 placeholder-gray-400"
                    rows={5}
                    placeholder="Descreva o motivo..."
                  />
                  <div className="flex gap-3">
                    <button onClick={handleJustificationSubmit} disabled={submitting}
                      className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-base active:scale-95 transition disabled:opacity-50">
                      Enviar justificativa
                    </button>
                    <button onClick={() => goToStep('confirmDesova')}
                      className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-base active:scale-95 transition">
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: desovaStart ── */}
              {currentStep === 'desovaStart' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                      <FaCamera className="text-orange-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Início da Desova</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo no cliente" />
                  <p className="text-gray-500 text-sm">Tire fotos do início da desova para registro</p>
                  <PhotoSection
                    onConfirm={() => compressAndUpload('inicioDesova', 'EM_DESOVA', 'desovaProgress', { desovaStartAt: new Date().toISOString() })}
                    onBack={() => goToStep('confirmDesova')}
                    buttonLabel="✓ Confirmar desova"
                    buttonColor="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
                  />
                </div>
              )}

              {/* ── STEP: desovaProgress ── */}
              {currentStep === 'desovaProgress' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                      <FaWarehouse className="text-blue-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Desova em Andamento</h3>
                  </div>
                  <StepTimer start={currentDelivery?.desovaStartAt || currentDelivery?.arrivedAt} label="Tempo em desova" />
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <p className="text-blue-800 font-semibold text-sm">A desova já finalizou?</p>
                    <p className="text-gray-600 text-sm mt-1">Indique se a descarga foi completada</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => goToStep('desovaFinal')}
                      className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition">
                      ✓ Finalizou
                    </button>
                    <button onClick={() => goToStep('desovaNotYet')}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-base active:scale-95 transition">
                      Ainda não
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: desovaNotYet ── */}
              {currentStep === 'desovaNotYet' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                    <p className="text-yellow-800 font-bold text-base mb-1">⏳ Aguardando...</p>
                    <p className="text-gray-600 text-sm">Deseja relatar algum problema?</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => goToStep('desovaNotYetObs')}
                      className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-base active:scale-95 transition">
                      Relatar problema
                    </button>
                    <button onClick={() => goToStep('desovaNotYetMsg')}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-base active:scale-95 transition">
                      Está tudo certo
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: desovaNotYetObs ── */}
              {currentStep === 'desovaNotYetObs' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Relatar ocorrência</h3>
                  <textarea
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-gray-800 placeholder-gray-400"
                    rows={5}
                    placeholder="Descreva o que está acontecendo..."
                  />
                  <div className="flex gap-3">
                    <button onClick={async () => { await handleJustificationSubmit(); goToStep('desovaProgress'); }} disabled={submitting || !justification.trim()}
                      className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base active:scale-95 transition disabled:opacity-50">
                      Enviar
                    </button>
                    <button onClick={() => goToStep('desovaProgress')}
                      className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-base active:scale-95 transition">
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: desovaNotYetMsg ── */}
              {currentStep === 'desovaNotYetMsg' && (
                <div className="space-y-4 text-center py-4">
                  <div className="text-5xl">👍</div>
                  <h3 className="text-xl font-bold text-emerald-700">Perfeito!</h3>
                  <p className="text-gray-600">Quando a desova finalizar, nos informe!</p>
                  <button onClick={() => goToStep('desovaProgress')}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-base active:scale-95 transition mt-4">
                    Verificar novamente
                  </button>
                </div>
              )}

              {/* ── STEP: desovaFinal ── */}
              {currentStep === 'desovaFinal' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
                      <FaCamera className="text-teal-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Finalização da Desova</h3>
                  </div>
                  <StepTimer start={currentDelivery?.desovaStartAt || currentDelivery?.arrivedAt} label="Tempo em desova" />
                  <p className="text-gray-500 text-sm">Registre com foto a finalização da desova</p>
                  <PhotoSection
                    onConfirm={() => compressAndUpload('fimDesova', 'DESOVA_FINALIZADA', 'askSchedule', { desovaEndAt: new Date().toISOString() })}
                    onBack={() => goToStep('desovaProgress')}
                    buttonLabel="✓ Desova concluída"
                    buttonColor="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
                  />
                </div>
              )}

              {/* ── STEP: askSchedule ── */}
              {currentStep === 'askSchedule' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                      <FaCalendarAlt className="text-purple-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Devolução do Container</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo total" />
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                    <p className="text-purple-800 font-semibold text-sm mb-1">📅 Precisa agendar a devolução?</p>
                    <p className="text-gray-600 text-sm">Se sim, o administrativo será notificado</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleScheduleDecision(true)}
                      className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition">
                      📅 Sim, agendar
                    </button>
                    <button onClick={() => handleScheduleDecision(false)}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-base active:scale-95 transition">
                      Não
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: finalDocs ── */}
              {currentStep === 'finalDocs' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
                      <FaFileAlt className="text-teal-600" size={14} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Documentos Finais</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo total" />

                  {submitting && (
                    <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-300 rounded-xl">
                      <svg className="animate-spin h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span className="text-teal-700 font-semibold text-sm">Enviando documentos...</span>
                    </div>
                  )}

                  {/* Progress summary bar */}
                  {(() => {
                    const requiredDocs = ['canhotCTE', 'diarioBordo', 'canhotNF'];
                    const done = requiredDocs.filter(k => documentsUpload[k] && documentsUpload[k].length > 0).length;
                    return (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                          <span>Documentos anexados</span>
                          <span className={done === 3 ? 'text-emerald-600' : 'text-amber-600'}>{done}/3</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${done === 3 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${(done / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'canhotCTE', label: 'Canhoto CTE', emoji: '🚛' },
                      { key: 'canhotNF', label: 'Canhoto NF', emoji: '📦' },
                      { key: 'diarioBordo', label: 'Diário de Bordo', emoji: '📋' },
                    ].map(doc => (
                      <DocUploadCard
                        key={doc.key}
                        docType={doc.key}
                        label={doc.label}
                        emoji={doc.emoji}
                        value={documentsUpload[doc.key]}
                        disabled={submitting}
                        onChange={() => {
                          if (submitting) return;
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*,application/pdf';
                          input.multiple = true;
                          input.onchange = e => {
                            if (e.target.files) setDocumentsUpload(prev => ({ ...prev, [doc.key]: Array.from(e.target.files) }));
                          };
                          input.click();
                        }}
                        onCamera={() => {
                          if (submitting) return;
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.capture = 'environment';
                          input.onchange = e => {
                            if (e.target.files && e.target.files.length > 0) {
                              setDocumentsUpload(prev => ({ ...prev, [doc.key]: [...(prev[doc.key] || []), ...Array.from(e.target.files)] }));
                            }
                          };
                          input.click();
                        }}
                      />
                    ))}
                  </div>

                  {!['canhotCTE', 'diarioBordo', 'canhotNF'].every(k => documentsUpload[k] && documentsUpload[k].length > 0) && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FaExclamationTriangle className="text-amber-500" size={14} />
                        <label className="text-sm font-bold text-amber-900">Justificativa para docs faltantes</label>
                      </div>
                      <textarea
                        value={documentsJustification}
                        onChange={e => setDocumentsJustification(e.target.value)}
                        placeholder="Descreva por que não é possível anexar o(s) documento(s)..."
                        className="w-full px-3 py-2.5 border-2 border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none text-sm bg-white"
                        rows={3}
                        disabled={submitting}
                      />
                      {!documentsJustification.trim() && (
                        <p className="text-xs text-amber-700 mt-1.5 font-medium">* Obrigatório para finalizar sem todos os documentos</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleFinalUploadAndSubmit}
                      disabled={submitting}
                      className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-base shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Enviando...
                        </span>
                      ) : '✓ Documentos enviados'}
                    </button>
                    <button onClick={() => goToStep('askSchedule')} disabled={submitting}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-base active:scale-95 transition disabled:opacity-50">
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: agradecimento ── */}
              {currentStep === 'agradecimento' && (
                <div className="space-y-6 text-center py-6">
                  <div className="text-7xl animate-bounce">🎉</div>
                  <div>
                    <h3 className="text-3xl font-extrabold text-emerald-600 mb-2">Excelente trabalho!</h3>
                    <p className="text-gray-600 text-base">Entrega concluída com sucesso</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-5 rounded-2xl text-left space-y-2">
                    <p className="text-sm font-bold text-gray-800">✅ Fotos registradas</p>
                    <p className="text-sm font-bold text-gray-800">✅ Documentos enviados</p>
                    <p className="text-sm font-bold text-gray-800">✅ Entrega finalizada</p>
                  </div>
                  <button onClick={closeModal}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition">
                    ✓ Voltar à lista
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramadasEntregas;
