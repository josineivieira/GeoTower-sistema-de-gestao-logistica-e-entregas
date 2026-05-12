// Configurações estáticas de Status/Colunas Kanban
import { 
  FaPlus, FaClock, FaBox, FaTruck, FaMapMarkerAlt, 
  FaShippingFast, FaCheckCircle, FaUndo 
} from 'react-icons/fa';
import { getDesovaStepLabel } from '../utils/cityLabels';

const normalizeKey = (s) => {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').toUpperCase().trim();
};

export const getStatusColumns = (city = 'manaus') => [
  {
    key: 'NOVO_PROCESSO',
    title: 'Novo Processo',
    description: 'Sem motorista',
    icon: FaPlus,
    gradient: 'from-blue-500 to-blue-600',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    filter: (p) => !p.driverName || p.driverName === '-' || String(p.driverName).trim() === '',
  },
  {
    key: 'PROGRAMADO',
    title: 'Programado',
    description: 'Agendado c/ motorista',
    icon: FaClock,
    gradient: 'from-violet-500 to-purple-600',
    lightBg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    filter: (p) => ['AGENDADO', 'NO PORTO AGUARDANDO MONTAGEM'].includes(normalizeKey(p.status)) && p.driverName && p.driverName !== '-',
  },
  {
    key: 'CNTR_COLETADO',
    title: 'CNTR Coletado',
    description: 'Container montado',
    icon: FaBox,
    gradient: 'from-emerald-500 to-green-600',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    filter: (p) => normalizeKey(p.status) === 'CONTAINER MONTADO',
  },
  {
    key: 'INICIAR_VIAGEM',
    title: 'Em Viagem',
    description: 'A caminho do cliente',
    icon: FaTruck,
    gradient: 'from-orange-500 to-amber-600',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    filter: (p) => {
      const s = normalizeKey(p.status);
      return s === 'A CAMINHO DO CLIENTE' || s === 'PENDING';
    },
  },
  {
    key: 'CHEGADA_CLIENTE',
    title: 'No Cliente',
    description: `Aguardando ${getDesovaStepLabel(city).toLowerCase()}`,
    icon: FaMapMarkerAlt,
    gradient: 'from-yellow-500 to-amber-500',
    lightBg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    filter: (p) => normalizeKey(p.status) === 'AGUARDANDO DESOVA',
  },
  {
    key: 'OPERACAO_INICIADA',
    title: 'Op. Iniciada',
    description: 'Em desova/Ovação',
    icon: FaShippingFast,
    gradient: 'from-rose-500 to-red-600',
    lightBg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    filter: (p) => normalizeKey(p.status) === 'EM DESOVA',
  },
  {
    key: 'OPERACAO_FINALIZADA',
    title: 'Op. Finalizada',
    description: 'Fim Desova/Ovação',
    icon: FaCheckCircle,
    gradient: 'from-teal-500 to-emerald-600',
    lightBg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700',
    filter: (p) => {
      const s = normalizeKey(p.status);
      return s === 'ANEXANDO DOCUMENTOS FINAIS' || s === 'DESOVA FINALIZADA' || s === 'SAINDO CLIENTE';
    },
  },
  {
    key: 'VIAGEM_RETORNO',
    title: 'Retorno',
    description: 'Pend. Baixa',
    icon: FaUndo,
    gradient: 'from-cyan-500 to-sky-600',
    lightBg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
    filter: (p) => {
      const s = normalizeKey(p.status);
      const isPendDevolucao = s === 'PEND. DEVOLUCAO' || s === 'PEND. DEVOLUÇÃO';
      const isRetornoEmAndamento = s === 'RETORNANDO PORTO' || s === 'CHEGOU PORTO';
      const isFinalizado = s === 'FINALIZADO';
      const semDataDevolucao = !p.dtDevolucaoCNTR && !p.horarioDevolucaoVazio;
      return (isPendDevolucao || isRetornoEmAndamento || isFinalizado) && semDataDevolucao;
    },
  },
  {
    key: 'CNTR_ENTREGUE',
    title: 'CNTR Entregue',
    description: 'Container Baixado',
    icon: FaCheckCircle,
    gradient: 'from-green-600 to-teal-700',
    lightBg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    filter: (p) => {
      return (
        !!p.horarioDevolucaoVazio || !!p.dtDevolucaoCNTR || p.containerReturned === true
      );
    },
  },
];
