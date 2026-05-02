import { deliveryService, adminService, notificationService } from '../services/authService';
import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
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
import { useCity } from '../contexts/CityContext';
import { getProgramacaoDate } from '../utils/programacaoDate';
import { formatarData, formatarDataApenas, formatarHora, formatarAgendamento } from '../utils/date';
import { getRecebedoresLabel, getDesovaStatusLabel } from '../utils/cityLabels';
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

const TruckEmoji = () => null;

const ProgressiveTruck = ({ start }) => null;

const normalizeStatus = (status) => {
  const key = String(status || '').toUpperCase();
  return key === 'EM_ROTA' ? 'A_CAMINHO_DO_CLIENTE' : key;
};

const getDeliveryTimestamp = (delivery) => {
  const time = new Date(delivery?.updatedAt || delivery?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const deliveryBelongsToProgramacao = (delivery, programacaoId) => {
  if (!delivery || !programacaoId) return false;
  return String(delivery.programacaoId || '') === String(programacaoId) ||
    String(delivery.linkedProgramacaoId || '') === String(programacaoId);
};

const selectDeliveryForProgramacao = (deliveries, programacaoId, programacao = null) => {
  const list = Array.isArray(deliveries) ? deliveries : [];
  const linked = list.filter(d => deliveryBelongsToProgramacao(d, programacaoId));
  const sameParty = programacao
    ? list.filter(d => normalizeGroupValue(d.recebedor) === normalizeGroupValue(programacao.recebedor))
    : [];
  const candidates = linked.length > 0 ? linked : (sameParty.length > 0 ? sameParty : list);
  return candidates.reduce((best, next) =>
    !best || getDeliveryTimestamp(next) > getDeliveryTimestamp(best) ? next : best,
    null
  );
};

const normalizeGroupValue = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toUpperCase();

const getProgramacaoGroupKey = (programacao) => {
  const container = normalizeGroupValue(programacao?.container || programacao?.processo);
  const party = normalizeGroupValue(programacao?.recebedor);
  return `${container || 'SEM_CONTAINER'}::${party || 'SEM_CLIENTE'}`;
};

const buildInitialDeliveryObservation = (programacao, flowText) => {
  const icompanyObs = String(programacao?.observacoes || '').trim();
  const flowObs = String(flowText || '').trim();
  const parts = [];

  if (icompanyObs) parts.push(`Observação Icompany: ${icompanyObs}`);
  if (flowObs) parts.push(flowObs);

  return parts.join('\n');
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

const StatusBadge = ({ status, containerReturned, overrideLabel: externalOverride }) => {
  let key = status || 'pending';
  let overrideLabel = externalOverride;
  // show special message when finalizado but still waiting for empty return
  if (key === 'FINALIZADO' && !containerReturned && !overrideLabel) {
    overrideLabel = 'PEND. Entrega CNTR Porto';
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

// City-aware status badge wrapper (only changes display text)
const CityStatusBadge = ({ status, containerReturned }) => {
  const { city } = useCity();
  const cityLabel = getDesovaStatusLabel(status, city);
  return <StatusBadge status={status} containerReturned={containerReturned} overrideLabel={cityLabel} />;
};

// Step indicator for modal flows (static keys, labels made dynamic per city)
const FLOW_STEPS_BASE = [
  { key: 'welcome',         labelKey: 'Início' },
  { key: 'arrival',         labelKey: 'Chegada' },
  { key: 'confirmDesova',   labelKey: 'desova' }, // Dynamic label based on city
  { key: 'desovaProgress',  labelKey: 'Progresso' },
  { key: 'askSchedule',     labelKey: 'Devolução' },
  { key: 'finalDocs',       labelKey: 'Docs' },
];
const STEP_INDEX = Object.fromEntries(FLOW_STEPS_BASE.map((s, i) => [s.key, i]));

const FlowStepBar = ({ currentStep, city = 'manaus' }) => {
  const idx = STEP_INDEX[currentStep] ?? 0;
  const getStepLabel = (step) => {
    if (step.labelKey === 'desova') {
      return city === 'itajai' ? 'Ovação' : 'Desova';
    }
    return step.labelKey;
  };
  return (
    <div className="flex items-center justify-between mb-6 px-1">
      {FLOW_STEPS_BASE.map((s, i) => (
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
              {getStepLabel(s)}
            </span>
          </div>
          {i < FLOW_STEPS_BASE.length - 1 && (
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
        <div key={photo.id} className="relative rounded-xl overflow-hidden shadow-md aspect-square">
          <img src={photo.data} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
          <button
            onClick={() => onRemove(photo.id)}
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
  const { city } = useCity();

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
  const [arrivalDelayReason, setArrivalDelayReason] = useState('');
  const [arrivalDelayError, setArrivalDelayError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [showMontagemModal, setShowMontagemModal] = useState(false);
  const [montagemProgramacao, setMontagemProgramacao] = useState(null);
  const [montagemSubmitting, setMontagemSubmitting] = useState(false);
  const [montagemComprovas, setMontagemComprovas] = useState([]);
  const montagemComprovanteRef = useRef(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnProof, setReturnProof] = useState(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const [showContainerReturnModal, setShowContainerReturnModal] = useState(false);
  const [currentProgramacaoForReturn, setCurrentProgramacaoForReturn] = useState(null);
  const [containerVazioProof, setContainerVazioProof] = useState(null);
  const [containerVazioSubmitting, setContainerVazioSubmitting] = useState(false);
  const containerVazioProofRef = useRef(null);

  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [sortBy, setSortBy] = useState('data');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => { loadProgramacoes(); }, [user]);

  // Sincronização automática a cada 30 segundos para múltiplos clientes/dispositivos
  useEffect(() => {
    const syncInterval = setInterval(() => {
      console.log('🔄 [ProgramadasEntregas] Sincronizando programações...');
      loadProgramacoes({ silent: true });
      // Se houver entrega aberta, sincroniza também
      if (currentDelivery && currentDelivery._id) {
        deliveryService.getDelivery(currentDelivery._id).then(res => {
          const updated = res.data.delivery;
          console.log('🔄 [ProgramadasEntregas] Status atual do servidor:', {
            deliveryNumber: updated.deliveryNumber,
            statusAtual: currentDelivery.status,
            statusNoServidor: updated.status,
            mudou: updated.status !== currentDelivery.status
          });
          // Só atualiza se o status mudou (detecta mudanças de outros clientes)
          if (updated.status !== currentDelivery.status) {
            console.log('⚠️ [ProgramadasEntregas] STATUS MUDOU! Atualizando de', currentDelivery.status, 'para', updated.status);
            applyDeliveryUpdate(updated);
            setToast({ 
              message: `Status atualizado: ${updated.status}`, 
              type: 'info' 
            });
            setTimeout(() => setToast(null), 3000);
          }
        }).catch((err) => {
          console.error('❌ [ProgramadasEntregas] Erro ao sincronizar:', err.message);
        });
      }
    }, 10000);

    return () => clearInterval(syncInterval);
  }, [currentDelivery]);

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

  const loadProgramacoes = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminService.getProgramacoes();
      const todas = res.data.programacoes || [];
      setAllProgramacoes(todas);
      let nomeFiltro = '';
      if (user) nomeFiltro = (user.name || '').trim().toUpperCase();
      let filtradas = [];
      if (nomeFiltro) filtradas = todas.filter(p => String(p.contratado).trim().toUpperCase() === nomeFiltro);
      
      const deliveriesRes = await deliveryService.getMyDeliveries({ includeCanceled: true });
      const deliveries = deliveriesRes.data.deliveries || [];
      const map = {};
      const deliveriesByNumber = {};
      const programacaoMap = {};
      deliveries.forEach(d => {
        const key = (d.deliveryNumber || '').toUpperCase();
        if (!deliveriesByNumber[key]) deliveriesByNumber[key] = [];
        deliveriesByNumber[key].push(d);
        const existing = map[key];
        if (!existing || getDeliveryTimestamp(d) >= getDeliveryTimestamp(existing)) {
          map[key] = d;
        }
        [d.programacaoId, d.linkedProgramacaoId].filter(Boolean).forEach(id => {
          const progKey = String(id);
          const existingProg = programacaoMap[progKey];
          if (!existingProg || getDeliveryTimestamp(d) >= getDeliveryTimestamp(existingProg)) {
            programacaoMap[progKey] = d;
          }
        });
      });
      setDeliveriesMap(map);
      
      // Remover apenas programações canceladas ou que já tiveram o container vazio devolvido
      const visibleProgramacoes = filtradas.filter(p => {
        const status = String(p.status || '').toUpperCase();
        if (['CANCELADO'].includes(status)) return false;

        // Se marcada como containerReturned, não mostra
        if (p.containerReturned === true) return false;
        if (p.horarioDevolucaoVazio) return false;

        // Se o delivery indexado por programacaoId já tem comprovante, não mostra
        const byProg = programacaoMap[String(p._id)];
        if (byProg && byProg.documents && (byProg.documents.devolucaoVazio || byProg.documents.devolucaoContainerVazio) && ((byProg.documents.devolucaoVazio && byProg.documents.devolucaoVazio.length > 0) || (byProg.documents.devolucaoContainerVazio && byProg.documents.devolucaoContainerVazio.length > 0))) {
          return false;
        }
        // also hide if delivery has observation marker (in case document upload failed)
        if (byProg && byProg.observations && (byProg.observations.includes('(CONTAINER_VAZIO_DEVOLVIDO)') || byProg.observations.includes('(Baixa_Container)'))) {
          return false;
        }

        // Tentar buscar o delivery por programacaoId primeiro, depois linkedDeliveryId, e só então por número
        let matchedDelivery = byProg || null;
        if (!matchedDelivery && p.linkedDeliveryId) {
          matchedDelivery = deliveries.find(d => d._id === p.linkedDeliveryId);
          if (matchedDelivery && matchedDelivery.documents && ((matchedDelivery.documents.devolucaoVazio && matchedDelivery.documents.devolucaoVazio.length > 0) || (matchedDelivery.documents.devolucaoContainerVazio && matchedDelivery.documents.devolucaoContainerVazio.length > 0))) {
            return false;
          }
        }

        // Fallback: buscar por container/processo
        const key = ((p.container || p.processo || '').toUpperCase());
        if (!matchedDelivery) {
          const candidates = deliveriesByNumber[key] || [];
          if (candidates.length > 0) {
            matchedDelivery = selectDeliveryForProgramacao(candidates, p._id, p);
          }
        }
        if (matchedDelivery && matchedDelivery.documents && ((matchedDelivery.documents.devolucaoVazio && matchedDelivery.documents.devolucaoVazio.length > 0) || (matchedDelivery.documents.devolucaoContainerVazio && matchedDelivery.documents.devolucaoContainerVazio.length > 0))) {
          return false;
        }

        // Se houver delivery associado, atualizar o status exibido na programação
        if (matchedDelivery) {
          p.status = normalizeStatus(matchedDelivery.status) || p.status;
          if (matchedDelivery.containerReturned !== undefined) {
            p.containerReturned = matchedDelivery.containerReturned;
          }
        }

        return true;
      });
      setProgramacoes(visibleProgramacoes);
      setToast(null);
    } catch (err) {
      setToast({ message: 'Erro ao carregar entregas programadas', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      if (!silent) setLoading(false);
    }
  };;

  const updateProgramacaoInList = (programacaoId, updates) => {
    if (!programacaoId) return;
    const applyUpdates = (items) => items.map(item =>
      String(item._id) === String(programacaoId) ? { ...item, ...updates } : item
    );
    setProgramacoes(applyUpdates);
    setAllProgramacoes(applyUpdates);
    setCurrentProgramacao(prev =>
      prev && String(prev._id) === String(programacaoId) ? { ...prev, ...updates } : prev
    );
  };

  const applyDeliveryUpdate = (delivery, programacaoId = currentProgramacao?._id) => {
    if (!delivery) return;
    setCurrentDelivery(delivery);
    if (delivery.deliveryNumber) {
      setDeliveriesMap(prev => ({
        ...prev,
        [String(delivery.deliveryNumber).toUpperCase()]: delivery
      }));
    }
    if (programacaoId) {
      updateProgramacaoInList(programacaoId, {
        linkedDeliveryId: delivery._id,
        status: normalizeStatus(delivery.status),
        containerReturned: !!delivery.horarioDevolucaoVazio
      });
    }
  };

  const handleStartDelivery = async (p) => {
    const deliveryNumber = (p.container && p.container.trim()) || (p.processo && p.processo.trim());
    if (!deliveryNumber) { setToast({ message: 'Sem número de container/processo', type: 'error' }); return; }
    try {
      setSubmitting(true);
      let existing = null;
      try {
        const searchRes = await deliveryService.getMyDeliveries({ q: deliveryNumber.toUpperCase(), includeCanceled: true });
        const list = searchRes.data.deliveries || [];
        const exactMatches = list.filter(d => String(d.deliveryNumber).toUpperCase() === deliveryNumber.toUpperCase());
        if (exactMatches.length > 0) {
          existing = selectDeliveryForProgramacao(exactMatches, p._id, p);
        }
      } catch (_) {}

      if (existing) {
        setCurrentDelivery(existing);
        setCurrentProgramacao(p);
        console.log('🔍 [ProgramadasEntregas] Entrega restaurada:', {
          deliveryNumber: existing.deliveryNumber,
          status: existing.status,
          currentStep: existing.currentStep,
          _id: existing._id
        });
        if (existing.status === 'CONTAINER_MONTADO') {
          const updated = await deliveryService.updateDelivery(existing._id, { status: 'A_CAMINHO_DO_CLIENTE' });
          existing = updated.data.delivery;
          applyDeliveryUpdate(existing, p._id);
        }
        let restoredStep = 'welcome';
        switch ((existing.status || '').toUpperCase()) {
          case 'AGUARDANDO_DESOVA': restoredStep = 'confirmDesova'; break;
          case 'EM_DESOVA': restoredStep = 'desovaProgress'; break;
          case 'AGUARDANDO_ANEXO': case 'ANEXANDO_DOCUMENTOS_FINAIS': restoredStep = 'finalDocs'; break;
          case 'DESOVA_FINALIZADA': case 'AGUARDANDO_AGENDAMENTO_DEVOLUCAO': restoredStep = 'askSchedule'; break;
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
          observations: buildInitialDeliveryObservation(p, `Criada a partir da Programação ${p.processo || ''}`),
          programacaoId: p._id,
          recebedor: p.recebedor || '',
          driverName: p.motorista || user?.fullName || user?.name || ''
        };
        const res = await deliveryService.createDelivery(payload);
        const newDelivery = res.data.delivery;
        applyDeliveryUpdate(newDelivery, p._id);
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
    console.log('🔙 [ProgramadasEntregas] Fechando modal de entrega');
    setShowModal(false); 
    setCurrentStep('welcome'); 
    setCurrentDelivery(null); 
    setCurrentProgramacao(null);
    setPhotos([]); 
    setObservations(''); 
    setJustification(''); 
    setDocumentsUpload({}); 
    setDocumentsJustification('');
    loadProgramacoes({ silent: true });
    // Não recarrega lista - polling automático já sincroniza a cada 30s
  };

  const handleStartMontagem = async (p) => { setMontagemProgramacao(p); setShowMontagemModal(true); };

  const openReturnModal = (p) => { setCurrentProgramacao(p); setReturnProof(null); setShowReturnModal(true); };
  const closeReturnModal = () => { setShowReturnModal(false); setReturnProof(null); setCurrentProgramacao(null); };

  const handleReturn = async () => {
    if (!currentProgramacao) return;
    setReturnSubmitting(true);
    try {
      const isPendingCanhoto = Array.isArray(currentProgramacao.missingDocumentsAtSubmit) && currentProgramacao.missingDocumentsAtSubmit.length > 0;
      const returnAt = new Date().toISOString();
      if (currentProgramacao.linkedDeliveryId) {
        if (returnProof) {
          const proofFile = await compressUploadFile(returnProof);
          await deliveryService.uploadDocument(currentProgramacao.linkedDeliveryId, 'devolucaoVazio', proofFile);
        }
        await deliveryService.updateDelivery(currentProgramacao.linkedDeliveryId, {
          status: isPendingCanhoto ? 'ENTREGUE_COM_PENDENCIA_CANHOTO' : 'FINALIZADO',
          horarioDevolucaoVazio: returnAt,
          programacaoId: currentProgramacao._id
        });
      } else {
        const searchVal = (currentProgramacao.container || currentProgramacao.processo || '').trim();
        if (searchVal) {
          const resp = await deliveryService.getMyDeliveries({ q: searchVal, includeCanceled: true });
          const found = selectDeliveryForProgramacao(resp.data.deliveries, currentProgramacao._id, currentProgramacao);
          if (found) {
            if (returnProof) {
              const proofFile = await compressUploadFile(returnProof);
              await deliveryService.uploadDocument(found._id, 'devolucaoVazio', proofFile);
            }
            await deliveryService.updateDelivery(found._id, {
              status: isPendingCanhoto ? 'ENTREGUE_COM_PENDENCIA_CANHOTO' : 'FINALIZADO',
              horarioDevolucaoVazio: returnAt,
              programacaoId: currentProgramacao._id
            });
          }
        }
      }
      try { await adminService.updateProgramacao(currentProgramacao._id, { status: 'FINALIZADO', containerReturned: true }); } catch (_) {}
      setProgramacoes(prev => prev.filter(p => p._id !== currentProgramacao._id));
      window.dispatchEvent(new Event('programacoesUpdated'));
      setToast({ message: 'Entrega CNTR Porto registrada!', type: 'success' });
      closeReturnModal();
      await loadProgramacoes({ silent: true });
      // Polling automático sincroniza lista a cada 30s
    } catch (err) {
      setToast({ message: 'Erro ao fazer Entrega CNTR Porto', type: 'error' });
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleMontagemFinished = async (finished) => {
    if (!finished) return;
    if (!montagemComprovas || montagemComprovas.length === 0) { setToast({ message: 'Anexe pelo menos um comprovante da montagem', type: 'error' }); return; }
    try {
      setMontagemSubmitting(true);
      const deliveryNumber = (montagemProgramacao.container && montagemProgramacao.container.trim()) ||
        (montagemProgramacao.processo && montagemProgramacao.processo.trim());
      if (!deliveryNumber) { setToast({ message: 'Sem número de container/processo', type: 'error' }); setShowMontagemModal(false); setMontagemProgramacao(null); return; }
      const payload = {
        deliveryNumber: deliveryNumber.toUpperCase(),
        observations: buildInitialDeliveryObservation(
          montagemProgramacao,
          `Montagem finalizada em ${formatarData(new Date(), city)}`
        ),
        driverName: montagemProgramacao.motorista || user?.fullName || user?.name || '',
        containerMontadoAt: new Date().toISOString(),
        status: 'CONTAINER_MONTADO',
        programacaoId: montagemProgramacao._id,
        recebedor: montagemProgramacao.recebedor || ''
      };
      let delivery = null;
      try {
        const searchRes = await deliveryService.getMyDeliveries({ q: deliveryNumber.toUpperCase(), includeCanceled: true });
        const list = searchRes.data.deliveries || [];
        const exactMatches = list.filter(d => String(d.deliveryNumber).toUpperCase() === deliveryNumber.toUpperCase());
        let existing = null;
        if (exactMatches.length > 0) {
          existing = selectDeliveryForProgramacao(exactMatches, montagemProgramacao._id, montagemProgramacao);
        }
        if (existing) {
          await deliveryService.updateDelivery(existing._id, payload);
          const refreshed = await deliveryService.getDelivery(existing._id);
          delivery = refreshed.data.delivery;
        } else {
          const res = await deliveryService.createDelivery(payload);
          delivery = res.data.delivery;
        }
      } catch (err) {
        const res = await deliveryService.createDelivery(payload);
        delivery = res.data.delivery;
      }
      // Enviar múltiplas fotos
      for (const file of montagemComprovas) {
        try {
          const compressed = await compressUploadFile(file);
          await deliveryService.uploadDocument(delivery._id, 'retiradaCheio', compressed);
        } catch (_) {}
      }
      setToast({ message: 'Container montado com sucesso!', type: 'success' });
      await loadProgramacoes({ silent: true });
      setShowMontagemModal(false); 
      setMontagemProgramacao(null); 
      setMontagemComprovas([]);
      // Polling automático sincroniza lista a cada 30s
    } catch (err) {
      setToast({ message: err?.response?.data?.message || 'Erro ao marcar montagem', type: 'error' });
    } finally {
      setMontagemSubmitting(false);
    }
  };

  const closeMontagemModal = () => { setShowMontagemModal(false); setMontagemProgramacao(null); setMontagemComprovas([]); };

  const goToStep = async (step) => {
    setPhotos([]);
    if (step === 'arrival') {
      setArrivalDelayReason('');
      setArrivalDelayError('');
    }
    setCurrentStep(step);
    try {
      if (currentDelivery && currentDelivery._id) {
        // Salva passo no backend
        const updated = await deliveryService.updateDelivery(currentDelivery._id, { currentStep: step });
        applyDeliveryUpdate(updated.data.delivery);
        // Apenas refaz fetch se for crítico, não em cada mudança de passo
        // Isso evita perder dados locais não salvos
      }
    } catch (_) {}
  };

  const handleArrivalConfirm = async () => {
    const scheduled = currentProgramacao ? getProgramacaoDate(currentProgramacao, city) : null;
    const isLate = scheduled ? Date.now() > new Date(scheduled).getTime() : false;
    if (isLate && !arrivalDelayReason.trim()) {
      setArrivalDelayError('Informe o motivo do atraso para prosseguir');
      return;
    }

    let observationsToUpdate = undefined;
    if (isLate) {
      const existingObs = currentDelivery?.observations || '';
      const timestamp = formatarData(new Date(), city);
      const delayNote = `[${timestamp}] Motivo do atraso na chegada: ${arrivalDelayReason.trim()}`;
      observationsToUpdate = existingObs ? `${existingObs}\n${delayNote}` : delayNote;
    }

    await compressAndUpload(
      'chegadaCliente',
      'AGUARDANDO_DESOVA',
      'confirmDesova',
      {
        arrivedAt: new Date().toISOString(),
        ...(observationsToUpdate ? { observations: observationsToUpdate } : {})
      }
    );
  };

  const removePhoto = (id) => setPhotos(prev => prev.filter(photo => photo.id !== id));

  const handleCameraCapture = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validar limite de 2 fotos
    const currentPhotoCount = photos.length;
    const maxPhotos = 2;
    
    if (currentPhotoCount >= maxPhotos) {
      setToast({ 
        message: `Máximo de ${maxPhotos} fotos permitidas. Remova uma para adicionar outra.`, 
        type: 'warning' 
      });
      return;
    }

    const photoPromises = files.map(file =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => {
          console.error(`Failed to read ${file.name}`);
          resolve(null);
        };
        reader.readAsDataURL(file);
      })
    );

    const photoDataUrls = await Promise.all(photoPromises);

    const validPhotos = photoDataUrls.filter(data => data !== null);

    if (validPhotos.length > 0) {
      flushSync(() => {
        // Limitar para não passar de 2 fotos totais
        const newPhotos = validPhotos.map(data => ({
          id: Date.now() + Math.random(),
          data
        }));
        const totalPhotos = [...photos, ...newPhotos];
        const limited = totalPhotos.slice(0, maxPhotos);
        setPhotos(limited);
      });
      console.log(`[PhotoCapture] Added ${validPhotos.length} photos. Total photos:`, validPhotos.length);
    }

    e.target.value = null;
  };

  function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
    return new File([u8arr], filename, { type: mime });
  }

  const compressPhotoFile = async (file) => {
    const options = {
      maxSizeMB: 0.25,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.7,
      maxIteration: 10
    };
    return await imageCompression(file, options);
  };

  const compressUploadFile = async (file) => {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    return await compressPhotoFile(file);
  };

  const compressUploadFiles = async (files) => {
    if (!Array.isArray(files)) return files;
    const compressed = [];
    for (const file of files) {
      compressed.push(await compressUploadFile(file));
    }
    return compressed;
  };

  const compressAndUpload = async (docKey, status, nextStep, timestamps = {}) => {
    if (!photos || photos.length === 0) { setToast({ message: 'Tire ao menos uma foto', type: 'error' }); return; }
    setSubmitting(true); setUploadProgress(0);
    try {
      const compressedFiles = [];
      for (let i = 0; i < photos.length; i++) {
        const file = dataURLtoFile(photos[i].data, `foto_${i}.jpg`);
        const compressed = await compressPhotoFile(file);
        compressedFiles.push(compressed);
        setUploadProgress(Math.round(((i + 1) / photos.length) * 60));
      }
      const updated = await deliveryService.uploadDocumentAndUpdate(currentDelivery._id, docKey, compressedFiles, { status, currentStep: nextStep, ...timestamps });
      applyDeliveryUpdate(updated.data.delivery);
      setUploadProgress(100);
      goToStep(nextStep);
      await loadProgramacoes({ silent: true });
      // Polling automático (30s) sincroniza lista - não precisa recarregar aqui
    } catch (err) {
      console.error(err);
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
      const timestamp = formatarData(new Date(), city);
      const updated = await deliveryService.updateDelivery(currentDelivery._id, { observations: `${existingObs ? existingObs + '\n' : ''}[${timestamp}] ${observations}` });
      applyDeliveryUpdate(updated.data.delivery);
      setToast({ message: 'Observação registrada', type: 'success' });
      goToStep('welcome');
    } catch (_) { setToast({ message: 'Erro ao salvar observação', type: 'error' }); }
  };

  const getDesovaObservationLabel = () => {
    const statusKey = String(currentDelivery?.status || '').toUpperCase();
    if (statusKey === 'EM_DESOVA') {
      return city === 'itajai' ? 'OVAÇÃO EM ANDAMENTO' : 'DESOVA EM ANDAMENTO';
    }
    return city === 'itajai' ? 'AGUARDANDO OVAÇÃO' : 'AGUARDANDO DESOVA';
  };

  const handleJustificationSubmit = async () => {
    if (!justification.trim()) { setToast({ message: 'Informe a justificativa', type: 'error' }); return; }
    try {
      const fresh = await deliveryService.getDelivery(currentDelivery._id);
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = formatarData(new Date(), city);
      const updated = await deliveryService.updateDelivery(currentDelivery._id, { observations: `${existingObs ? existingObs + '\n' : ''}[${timestamp}] (${getDesovaObservationLabel()}) ${justification}` });
      applyDeliveryUpdate(updated.data.delivery);
      setToast({ message: 'Justificativa enviada', type: 'success' });
      goToStep('confirmDesova');
    } catch (_) { setToast({ message: 'Erro ao enviar justificativa', type: 'error' }); }
  };

  const handleScheduleDecision = async (shouldSchedule) => {
    setScheduleSubmitting(true);
    try {
      if (shouldSchedule) {
        try {
          const fresh = await deliveryService.getDelivery(currentDelivery._id);
          const existingObs = fresh.data.delivery.observations || '';
          const timestamp = formatarData(new Date(), city);
          const obs = `(SOLICITACAO_AGENDAMENTO) Motorista solicitou agendamento de devolução do container.`;
          const obsUpdated = await deliveryService.updateDelivery(currentDelivery._id, { observations: `${existingObs ? existingObs + '\n' : ''}[${timestamp}] ${obs}` });
          applyDeliveryUpdate(obsUpdated.data.delivery);
          
          // Criar notificação para gestores/administradores
          try {
            const containerNum = currentDelivery?.deliveryNumber || currentDelivery?.containerNumber || 'N/A';
            const motoristaNome = currentDelivery?.driverName || user?.name || 'Desconhecido';
            console.log('📬 [ProgramadasEntregas] Enviando notificação com:', { containerNum, motoristaNome, currentDelivery });
            
            await notificationService.createNotification({
              title: 'Solicitação de Agendamento',
              message: `Motorista ${motoristaNome} solicitou agendamento de devolução para o container ${containerNum}.`,
              type: 'scheduling_request',
              deliveryId: currentDelivery._id,
              containerNumber: containerNum,
              driverName: motoristaNome
            });
          } catch (notifError) {
            console.warn('⚠️ [ProgramadasEntregas] Erro ao criar notificação:', notifError);
            // Não falha a operação principal por causa da notificação
          }
          
          setToast({ message: 'Solicitação enviada ao admin', type: 'success' });
        } catch (_) { setToast({ message: 'Erro ao enviar solicitação', type: 'error' }); }
      }
      // Atualiza status para proxima etapa (documentos finais)
      const updated = await deliveryService.updateDelivery(currentDelivery._id, { status: 'ANEXANDO_DOCUMENTOS_FINAIS', currentStep: 'finalDocs' });
      console.log('✅ [ProgramadasEntregas] Status atualizado para ANEXANDO_DOCUMENTOS_FINAIS');
      
      applyDeliveryUpdate(updated.data.delivery);
      
      // Prossegue para próxima etapa
      goToStep('finalDocs');
      await loadProgramacoes({ silent: true });
    } catch (err) {
      console.error('❌ [ProgramadasEntregas] Erro em handleScheduleDecision:', err);
      setToast({ message: 'Erro ao processar decisão', type: 'error' });
    } finally {
      setScheduleSubmitting(false);
    }
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
          const filesToUpload = await compressUploadFiles(documentsUpload[docType]);
          await deliveryService.uploadDocument(currentDelivery._id, docType, filesToUpload);
        }
      }

      // submit the delivery so the backend records missingDocumentsAtSubmit (if any)
      if (allOk) {
        await deliveryService.submitDelivery(currentDelivery._id);
      } else {
        await deliveryService.submitDelivery(currentDelivery._id, { force: true, observation: documentsJustification });
      }

      // update delivery to finalizado (backend tracking), but keep programacao as ENTREGUE
      const finalized = await deliveryService.updateDelivery(currentDelivery._id, { status: 'FINALIZADO' });
      applyDeliveryUpdate(finalized.data.delivery);
      try {
        await adminService.updateProgramacao(currentProgramacao._id, { status: 'ENTREGUE' });
        updateProgramacaoInList(currentProgramacao._id, { status: 'ENTREGUE' });
      } catch (_) {}

      const fresh = await deliveryService.getDelivery(currentDelivery._id);
      const existingObs = fresh.data.delivery.observations || '';
      const timestamp = formatarData(new Date(), city);
      const docsObs = documentsJustification ? `(JUSTIFICATIVA_DOCS) ${documentsJustification}` : '';
      const newObs = `${existingObs ? existingObs + '\n' : ''}${docsObs ? `[${timestamp}] ${docsObs}` : ''}`;
      // ensure observation stored as well
      const obsSaved = await deliveryService.updateDelivery(currentDelivery._id, { observations: newObs });
      applyDeliveryUpdate(obsSaved.data.delivery);

      setToast({ message: 'Documentos enviados! Agora faça a Entrega CNTR Porto.', type: 'success' });
      await loadProgramacoes({ silent: true });
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
        setToast({ message: 'Anexe o comprovante de Entrega CNTR Porto', type: 'error' });
        setContainerVazioSubmitting(false);
        return;
      }
      const deliveryNumber = (currentProgramacaoForReturn.container && currentProgramacaoForReturn.container.trim()) || (currentProgramacaoForReturn.processo && currentProgramacaoForReturn.processo.trim());
      let deliveryId = currentProgramacaoForReturn.linkedDeliveryId;
      if (!deliveryId && deliveryNumber) {
        const resp = await deliveryService.getMyDeliveries({ q: deliveryNumber, includeCanceled: true });
        const found = selectDeliveryForProgramacao(resp.data.deliveries, currentProgramacaoForReturn._id, currentProgramacaoForReturn);
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
          const proofFile = await compressUploadFile(containerVazioProof);
          await deliveryService.uploadDocument(deliveryId, 'devolucaoVazio', proofFile);
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
      const timestamp = formatarData(new Date(), city);
      const containerObs = `[${timestamp}] (${city === 'itajai' ? 'Baixa_Container' : 'CONTAINER_VAZIO_DEVOLVIDO'}) Entrega CNTR Porto devolvida com comprovante.`;
      const newObs = `${existingObs ? existingObs + '\n' : ''}${containerObs}`;
      const horarioDevolucaoVazio = new Date().toISOString();
      
      // Atualizar entrega com horário de devolução (backend marcará containerReturned na programação)
      const returned = await deliveryService.updateDelivery(deliveryId, { 
        status: finalStatus, 
        observations: newObs, 
        horarioDevolucaoVazio,
        programacaoId: currentProgramacaoForReturn._id 
      });
      applyDeliveryUpdate(returned.data.delivery, currentProgramacaoForReturn._id);

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
      await loadProgramacoes({ silent: true });
    } catch (err) {
      setToast({ message: 'Erro ao registrar Entrega CNTR Porto', type: 'error' });
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
      let aVal = sortBy === 'data' ? new Date(getProgramacaoDate(a, city) || 0).getTime() : String(a.container || '').length;
      let bVal = sortBy === 'data' ? new Date(getProgramacaoDate(b, city) || 0).getTime() : String(b.container || '').length;
      return sortOrder === 'desc' ? (bVal - aVal || String(bVal).localeCompare(String(aVal))) : (aVal - bVal || String(aVal).localeCompare(String(bVal)));
    });
    return result;
  };

  // Agrupamento por container + cliente. Mesmo container com cliente diferente vira outro card.
  const filteredProgramacoesRaw = getFilteredAndSorted();
  const groupedByContainer = {};
  filteredProgramacoesRaw.forEach(p => {
    const key = getProgramacaoGroupKey(p);
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
          <FaTruck size={14} /> Entregar Container no Porto
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
  const PhotoSection = ({ onConfirm, onBack, buttonLabel = 'Enviar registro', buttonColor = 'bg-emerald-600 hover:bg-emerald-700', confirmDisabled = false }) => (
    <div className="space-y-4">
      {/* Debug: Photo count */}
      {console.log(`[PhotoSection] Render - photos.length: ${photos.length}`) || null}
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
          disabled={submitting || photos.length === 0 || confirmDisabled}
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
              placeholder={`Buscar processo, container, ${city === 'itajai' ? 'remetente' : 'recebedor'}...`}
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
                  p.status === 'DESOVA_FINALIZADA' ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                  p.status === 'EM_DESOVA' ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                  p.status === 'AGUARDANDO_ANEXO' ? 'bg-gradient-to-r from-violet-400 to-fuchsia-500' :
                  p.status === 'ANEXANDO_DOCUMENTOS_FINAIS' ? 'bg-gradient-to-r from-teal-400 to-emerald-500' :
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
                    <CityStatusBadge status={p.status} containerReturned={p.containerReturned} />
                  </div>

                  {/* Info grid: mostra todos os recebedores/processos do grupo */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <FaUser size={10} className="text-purple-500" />
                        <span className="text-[11px] font-semibold text-gray-400 uppercase">{getRecebedoresLabel(city)}</span>
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
                          <li key={f._id}>{getProgramacaoDate(f, city) ? formatarAgendamento(getProgramacaoDate(f, city)) : '-'}</li>
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
           MODAL: DT ENTREGA CNTR PORTO
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
                    <h2 className="text-white text-xl font-extrabold">Entrega Container no Porto</h2>
                    <p className="text-white/70 text-sm">{currentProgramacao.processo}</p>
                  </div>
                </div>
                <button onClick={closeReturnModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-gray-600 text-sm">Anexe o comprovante de Entrega CNTR Porto para concluir o processo.</p>

              <div className={`rounded-2xl border-2 p-4 transition-all ${returnProof ? 'border-pink-400 bg-pink-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FaImage className="text-pink-500" size={18} />
                  <p className="font-bold text-gray-800 text-sm">Comprovante Entrega CNTR Porto</p>
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
                  ✅ Enviar Entrega CNTR Porto
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
                  { label: city === 'itajai' ? 'Remetente' : 'Recebedor', value: montagemProgramacao.recebedor || '-', icon: FaUser, color: 'text-purple-500' },
                  { label: 'Motorista', value: montagemProgramacao.motorista || '-', icon: FaTruck, color: 'text-emerald-500' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <item.icon className={`mx-auto mb-1 ${item.color}`} size={14} />
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">{item.label}</p>
                    <p className="text-xs font-bold text-gray-800 leading-tight truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Comprovante upload - múltiplas fotos */}
              <div className={`rounded-2xl border-2 p-4 transition-all ${montagemComprovas.length > 0 ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FaImage className="text-blue-500" size={18} />
                  <p className="font-bold text-gray-800 text-sm">Comprovantes de Montagem</p>
                  {montagemComprovas.length > 0 && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">{montagemComprovas.length}</span>}
                </div>
                {montagemComprovas.length > 0 ? (
                  <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                    {montagemComprovas.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-blue-100 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FaCheckCircle className="text-blue-500 shrink-0" size={14} />
                          <span className="text-xs font-bold text-blue-700 truncate">{file.name}</span>
                        </div>
                        <button onClick={() => setMontagemComprovas(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 shrink-0">
                          <FaTimes size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3 text-center">Nenhuma foto selecionada</p>
                )}
                <button
                  onClick={() => montagemComprovanteRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <FaCamera size={14} /> Adicionar Fotos
                </button>
                <input ref={montagemComprovanteRef} type="file" accept="image/*" capture="environment" multiple onChange={e => { 
                  const files = Array.from(e.target.files || []); 
                  if (files.length > 0) {
                    const maxPhotos = 2;
                    const currentCount = montagemComprovas.length;
                    if (currentCount >= maxPhotos) {
                      setToast({ message: `Máximo de ${maxPhotos} fotos permitidas. Remova uma para adicionar outra.`, type: 'warning' });
                      return;
                    }
                    const remaining = maxPhotos - currentCount;
                    const limitedFiles = files.slice(0, remaining);
                    setMontagemComprovas(prev => [...prev, ...limitedFiles]);
                    if (files.length > remaining) {
                      setToast({ message: `Apenas ${remaining} foto(s) adicionada(s). Limite de ${maxPhotos} atingido.`, type: 'info' });
                    }
                  }
                }} className="hidden" />
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
                disabled={montagemSubmitting || montagemComprovas.length === 0}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✅ Confirmar Container Montado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           MODAL: DT ENTREGA CNTR PORTO (CONTAINER VAZIO)
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
                    <h2 className="text-white text-xl font-extrabold">Dt Entrega CNTR Porto</h2>
                    <p className="text-white/70 text-sm">{currentProgramacaoForReturn.processo}</p>
                  </div>
                </div>
                <button onClick={closeContainerReturnModal} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-gray-600 text-sm">Anexe o comprovante de Entrega CNTR Porto para finalizar o processo.</p>

              <div className={`rounded-2xl border-2 p-4 transition-all ${containerVazioProof ? 'border-yellow-400 bg-yellow-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FaImage className="text-yellow-500" size={18} />
                  <p className="font-bold text-gray-800 text-sm">Comprovante Entrega CNTR Porto</p>
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
                  ✅ Confirmar Entrega CNTR Porto
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
              <FlowStepBar currentStep={currentStep} city={city} />
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
                          {formatarAgendamento(getProgramacaoDate(currentProgramacao, city))}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const statusKey = normalizeStatus(currentDelivery?.status);
                      return currentDelivery && statusKey === 'A_CAMINHO_DO_CLIENTE';
                    })() && (
                      <div className="pt-1 space-y-2">
                        <ProgressiveTruck start={currentDelivery.tripStartedAt || currentDelivery.createdAt} />
                        <div className="flex justify-between text-xs text-gray-500 px-1">
                          <span>Origem</span>
                          <span className="font-bold text-blue-600">
                            <ElapsedTimer start={currentDelivery.tripStartedAt || currentDelivery.createdAt} />
                          </span>
                          <span>Destino</span>
                        </div>
                      </div>
                    )}
                    <StepTimer start={currentDelivery?.createdAt || getProgramacaoDate(currentProgramacao, city)} label="Tempo total" />
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
                  {currentProgramacao && (() => {
                    const scheduled = getProgramacaoDate(currentProgramacao, city);
                    const isLate = scheduled ? Date.now() > new Date(scheduled).getTime() : false;
                    const delayMinutes = scheduled ? Math.max(0, Math.round((Date.now() - new Date(scheduled).getTime()) / 60000)) : 0;
                    return isLate ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-red-800">Chegada atrasada</p>
                          <p className="text-sm text-red-700">Você está {delayMinutes} minuto{delayMinutes === 1 ? '' : 's'} atrasado em relação ao horário agendado.</p>
                          <p className="text-sm text-red-600">Informe o motivo do atraso para confirmar a chegada.</p>
                        </div>
                        <textarea
                          value={arrivalDelayReason}
                          onChange={(e) => {
                            setArrivalDelayReason(e.target.value);
                            if (arrivalDelayError) setArrivalDelayError('');
                          }}
                          className="w-full rounded-2xl border border-red-200 bg-white p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                          rows={4}
                          placeholder="Explique o motivo do atraso..."
                        />
                        {arrivalDelayError && <p className="text-sm text-red-600">{arrivalDelayError}</p>}
                      </div>
                    ) : null;
                  })()}
                  <PhotoSection
                    onConfirm={handleArrivalConfirm}
                    onBack={() => goToStep('welcome')}
                    buttonLabel="✓ Confirmar chegada"
                    buttonColor="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    confirmDisabled={currentProgramacao && getProgramacaoDate(currentProgramacao, city) ? Date.now() > new Date(getProgramacaoDate(currentProgramacao, city)).getTime() && !arrivalDelayReason.trim() : false}
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
                    <h3 className="text-lg font-bold text-gray-900">Confirme a {city === 'itajai' ? 'Ovação' : 'Desova'}</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label={`Aguardando ${city === 'itajai' ? 'ovação' : 'desova'}`} />
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-amber-800 font-semibold text-sm mb-1">📦 {city === 'itajai' ? 'Ovação' : 'Desova'} iniciada?</p>
                    <p className="text-gray-600 text-sm">Indique se a descarga do container foi iniciada ou não</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => goToStep('desovaStart')}
                      className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                      ✓ {city === 'itajai' ? 'Ovação' : 'Desova'} iniciada
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
                    <p className="text-red-800 text-sm font-medium">Por que a {city === 'itajai' ? 'ovação' : 'desova'} não foi iniciada?</p>
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
                    <h3 className="text-lg font-bold text-gray-900">Início da {city === 'itajai' ? 'Ovação' : 'Desova'}</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo no cliente" />
                  <p className="text-gray-500 text-sm">Tire fotos do início da {city === 'itajai' ? 'ovação' : 'desova'} para registro</p>
                  <PhotoSection
                    onConfirm={() => compressAndUpload('inicioDesova', 'EM_DESOVA', 'desovaProgress', { desovaStartAt: new Date().toISOString() })}
                    onBack={() => goToStep('confirmDesova')}
                    buttonLabel={`✓ Confirmar ${city === 'itajai' ? 'ovação' : 'desova'}`}
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
                    <h3 className="text-lg font-bold text-gray-900">{city === 'itajai' ? 'Ovação' : 'Desova'} em Andamento</h3>
                  </div>
                  <StepTimer start={currentDelivery?.desovaStartAt || currentDelivery?.arrivedAt} label={`Tempo em ${city === 'itajai' ? 'ovação' : 'desova'}`} />
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <p className="text-blue-800 font-semibold text-sm">A {city === 'itajai' ? 'ovação' : 'desova'} já finalizou?</p>
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
                  <p className="text-gray-600">Quando a {city === 'itajai' ? 'ovação' : 'desova'} finalizar, nos informe!</p>
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
                    <h3 className="text-lg font-bold text-gray-900">Finalização da {city === 'itajai' ? 'Ovação' : 'Desova'}</h3>
                  </div>
                  <StepTimer start={currentDelivery?.desovaStartAt || currentDelivery?.arrivedAt} label={`Tempo em ${city === 'itajai' ? 'ovação' : 'desova'}`} />
                  <p className="text-gray-500 text-sm">Registre com foto a finalização da {city === 'itajai' ? 'ovação' : 'desova'}</p>
                  <PhotoSection
                    onConfirm={() => compressAndUpload('fimDesova', 'DESOVA_FINALIZADA', 'askSchedule', { desovaEndAt: new Date().toISOString() })}
                    onBack={() => goToStep('desovaProgress')}
                    buttonLabel={`✓ ${city === 'itajai' ? 'Ovação' : 'Desova'} concluída`}
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
                    <h3 className="text-lg font-bold text-gray-900">Entrega Container no Porto</h3>
                  </div>
                  <StepTimer start={currentDelivery?.arrivedAt || currentDelivery?.createdAt} label="Tempo total" />
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                    <p className="text-purple-800 font-semibold text-sm mb-1">📅 Precisa agendar a devolução?</p>
                    <p className="text-gray-600 text-sm">Se sim, o administrativo será notificado</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleScheduleDecision(true)}
                      disabled={scheduleSubmitting}
                      className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      {scheduleSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Solicitando...
                        </span>
                      ) : (
                        '📅 Sim, agendar'
                      )}
                    </button>
                    <button onClick={() => handleScheduleDecision(false)}
                      disabled={scheduleSubmitting}
                      className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-base active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      {scheduleSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Processando...
                        </span>
                      ) : (
                        'Não'
                      )}
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
                      { key: 'canhotCTE', label: city === 'itajai' ? 'CONTRATO' : 'Canhoto CTE', emoji: city === 'itajai' ? '📄' : '🚛' },
                      { key: 'canhotNF', label: city === 'itajai' ? 'TACÓGRAFO / RIC ABASTECINENTO' : 'Canhoto NF', emoji: city === 'itajai' ? '⏱️' : '📦' },
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
