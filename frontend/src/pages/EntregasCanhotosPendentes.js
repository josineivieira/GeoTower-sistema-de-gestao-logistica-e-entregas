import React, { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileUpload,
  FaSearch,
  FaSync,
  FaTruck,
  FaUpload,
  FaUser,
  FaCalendarAlt,
  FaBoxes,
  FaBuilding,
  FaRegCommentDots,
  FaExchangeAlt,
  FaHistory,
  FaList,
  FaLock,
  FaThLarge,
} from 'react-icons/fa';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useAuth } from '../services/authContext';
import { useCity } from '../contexts/CityContext';
import { getDocumentLabel } from '../utils/documentLabels';
import { formatarData } from '../utils/date';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Field = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={12} className="text-slate-400" />}
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">
        {label}
      </p>
    </div>
    <p className="text-sm font-semibold text-slate-700 break-words leading-relaxed">
      {value || '-'}
    </p>
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="mb-3">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
        <Icon size={14} />
      </div>
      <div>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, tone = 'slate', active = false, onClick }) => {
  const styles = {
    slate: {
      wrap: 'border-slate-200 bg-white',
      icon: 'bg-slate-100 text-slate-700',
      label: 'text-slate-400',
      value: 'text-slate-900',
    },
    amber: {
      wrap: 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50',
      icon: 'bg-amber-100 text-amber-700',
      label: 'text-amber-700',
      value: 'text-amber-800',
    },
    emerald: {
      wrap: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50',
      icon: 'bg-emerald-100 text-emerald-700',
      label: 'text-emerald-700',
      value: 'text-emerald-800',
    },
    blue: {
      wrap: 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50',
      icon: 'bg-blue-100 text-blue-700',
      label: 'text-blue-700',
      value: 'text-blue-800',
    },
  };

  const current = styles[tone] || styles.slate;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border p-4 shadow-sm transition hover:shadow-md',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        active && 'ring-4 ring-slate-300/50 shadow-md',
        current.wrap
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(
            'text-[10px] uppercase tracking-[0.22em] font-black',
            current.label
          )}>
            {label}
          </p>
          <p className={cn('mt-2 text-2xl font-black', current.value)}>
            {value}
          </p>
        </div>
        <div className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center',
          current.icon
        )}>
          <Icon size={16} />
        </div>
      </div>
    </Component>
  );
};

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

const formatSentido = (value) => {
  const sentido = String(value || '').trim().toUpperCase();
  if (sentido === 'ORIGEM') return 'Origem';
  if (sentido === 'DESTINO') return 'Destino';
  return '-';
};

const formatDeliveryStatus = (value) => {
  if (!value) return '-';
  const key = String(value).trim();
  if (key === 'submitted' || key === 'ENTREGUE') return 'OPERAÇÃO FINALIZADA';
  if (key === 'ENTREGUE_COM_PENDENCIA_CANHOTO') return 'FINALIZADO COM PENDÊNCIA';
  if (key === 'pending' || key === 'PENDING') return 'A CAMINHO DO CLIENTE';
  return key.replace(/_/g, ' ');
};

const RESPONSAVEL_CONFIG = {
  geolog: {
    label: 'GeoLog',
    field: 'retornoGeoLog',
    icon: FaTruck,
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    panel: 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50',
    button: 'bg-blue-600 hover:bg-blue-700',
    ring: 'focus:border-blue-300 focus:ring-blue-100',
  },
  geomar: {
    label: 'GeoMar',
    field: 'retornoGeoMar',
    icon: FaUser,
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    panel: 'border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50',
    button: 'bg-cyan-600 hover:bg-cyan-700',
    ring: 'focus:border-cyan-300 focus:ring-cyan-100',
  },
};

const getPendenciaResponsavel = (item) =>
  ['geomar', 'geolog'].includes(String(item?.pendenciaResponsavel || '').toLowerCase())
    ? String(item.pendenciaResponsavel).toLowerCase()
    : 'geolog';

const getUserPendenciaGroup = (role) => {
  if (role === 'geomar') return 'geomar';
  if (role === 'admin') return 'geolog';
  return '';
};

const getNextResponsavel = (current) => current === 'geomar' ? 'geolog' : 'geomar';

const PendingDocumentControl = ({ doc, city, disabled, disabledLabel, onUpload }) => {
  const inputId = useId();

  return (
    <div className="group rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3 transition hover:shadow-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
          <FaExclamationTriangle size={12} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] font-black text-amber-600">
            Documento pendente
          </p>
          <p className="text-sm font-bold truncate">
            {getDocumentLabel(doc, city)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <input
          id={inputId}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            if (disabled) {
              event.target.value = '';
              return;
            }
            onUpload(event.target.files);
            event.target.value = '';
          }}
        />

        <label
          htmlFor={inputId}
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition',
            disabled
              ? 'cursor-wait bg-slate-200 text-slate-400'
              : 'cursor-pointer border border-amber-200 bg-white text-amber-700 hover:bg-amber-100'
          )}
        >
          <FaUpload size={11} />
          {disabled && disabledLabel ? disabledLabel : disabled ? 'Anexando...' : 'Selecionar arquivos'}
        </label>
      </div>
    </div>
  );
};

const ReturnPanel = ({
  title,
  icon: Icon,
  value,
  draftValue,
  onChange,
  placeholder,
  disabled = false,
  helper,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
          Retorno operacional
        </p>
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
      </div>
    </div>

    {value && (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black mb-1">
          Último retorno
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
          {value}
        </p>
      </div>
    )}

    <textarea
      value={draftValue ?? ''}
      onChange={onChange}
      disabled={disabled}
      rows={5}
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none resize-y transition focus:bg-white focus:ring-4',
        disabled
          ? 'cursor-not-allowed text-slate-400'
          : 'focus:border-amber-300 focus:ring-amber-100'
      )}
      placeholder={placeholder}
    />
    {helper && (
      <p className="mt-2 text-xs font-semibold text-slate-500 leading-relaxed">
        {helper}
      </p>
    )}
  </div>
);

const DeliveryCardSkeleton = () => (
  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
    <div className="p-5 space-y-4 animate-pulse">
      <div className="flex justify-between gap-4">
        <div className="space-y-2 w-1/2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-6 w-56 rounded bg-slate-200" />
        </div>
        <div className="h-8 w-24 rounded-full bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-20 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="h-40 rounded-2xl bg-slate-100 xl:col-span-1" />
        <div className="h-40 rounded-2xl bg-slate-100 xl:col-span-2" />
      </div>
    </div>
  </div>
);

const ListCell = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-black">
      {label}
    </p>
    <p className="mt-1 text-sm font-bold text-slate-800 break-words">
      {value || '-'}
    </p>
  </div>
);

const EntregasCanhotosPendentes = () => {
  const navigate = useNavigate();
  const { city } = useCity();
  const { user } = useAuth();
  const userPendenciaGroup = getUserPendenciaGroup(user?.role);
  const isManagerViewOnly = user?.role === 'manager';

  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState(userPendenciaGroup || 'geomar');
  const [viewMode, setViewMode] = useState('cards');

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
        message: err.response?.data?.message || 'Erro ao carregar documentos pendentes',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const searchedItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!term) return true;

      return [
        item.processoCAB,
        item.processoLog,
        item.deliveryNumber,
        item.container,
        item.userName,
        item.driverName,
        item.recebedor,
        item.retornoGeoMar,
        item.retornoGeoLog,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [items, search]);

  const filteredItems = useMemo(() => {
    return searchedItems.filter((item) => getPendenciaResponsavel(item) === ownerFilter);
  }, [ownerFilter, searchedItems]);

  const visibleItems = viewMode === 'list' ? searchedItems : filteredItems;

  useEffect(() => {
    setOwnerFilter(userPendenciaGroup || 'geomar');
  }, [userPendenciaGroup]);

  const totalComGeoMar = items.filter(
    (item) => getPendenciaResponsavel(item) === 'geomar'
  ).length;

  const totalComGeoLog = items.filter(
    (item) => getPendenciaResponsavel(item) === 'geolog'
  ).length;

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
    const currentOwner = getPendenciaResponsavel(item);
    const currentConfig = RESPONSAVEL_CONFIG[currentOwner];
    const nextOwner = getNextResponsavel(currentOwner);

    if (currentOwner !== userPendenciaGroup) {
      setToast({
        type: 'warning',
        message: `Esta pendência está com ${currentConfig.label}. Aguarde o repasse para responder.`,
      });
      return;
    }

    const message = String(draft[currentConfig.field] || '').trim();

    if (!message) {
      setToast({
        type: 'warning',
        message: 'Digite uma nova observação antes de repassar',
      });
      return;
    }

    setSavingId(item._id);

    try {
      const res = await adminService.updateCanhotoRetornos(item._id, {
        [currentConfig.field]: message,
        repassarPara: nextOwner,
      });

      const updated = res.data?.delivery || {};

      setItems((prev) =>
        prev.map((row) =>
          row._id === item._id
            ? {
                ...row,
                retornoGeoMar: updated.retornoGeoMar ?? draft.retornoGeoMar ?? '',
                retornoGeoLog: updated.retornoGeoLog ?? draft.retornoGeoLog ?? '',
                pendenciaResponsavel:
                  updated.pendenciaResponsavel || nextOwner,
                pendenciaStatus:
                  updated.pendenciaStatus || row.pendenciaStatus,
                pendenciaHistorico:
                  updated.pendenciaHistorico || row.pendenciaHistorico || [],
                retornosPendenciaUpdatedAt:
                  updated.retornosPendenciaUpdatedAt || new Date().toISOString(),
                retornosPendenciaUpdatedBy:
                  updated.retornosPendenciaUpdatedBy || row.retornosPendenciaUpdatedBy,
              }
            : row
        )
      );

      setDrafts((prev) => ({
        ...prev,
        [item._id]: {
          retornoGeoMar: '',
          retornoGeoLog: '',
        },
      }));

      setToast({
        type: 'success',
        message: `Pendência repassada para ${RESPONSAVEL_CONFIG[nextOwner].label}`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao salvar retornos',
      });
    } finally {
      setSavingId(null);
    }
  };

  const concluirPendencia = async (item) => {
    const currentOwner = getPendenciaResponsavel(item);
    const draft = drafts[item._id] || {};
    const message = String(draft.retornoGeoMar || '').trim();
    const pendingDocs = Array.isArray(item.missingDocumentsAtSubmit)
      ? item.missingDocumentsAtSubmit
      : [];

    if (currentOwner !== 'geomar' || userPendenciaGroup !== 'geomar') {
      setToast({
        type: 'warning',
        message: 'A conclusão fica disponível apenas para GeoMar quando a pendência estiver com ela.',
      });
      return;
    }

    if (pendingDocs.length > 0) {
      setToast({
        type: 'warning',
        message: 'Ainda existem documentos pendentes para anexar antes da conclusão.',
      });
      return;
    }

    setSavingId(item._id);

    try {
      await adminService.concluirCanhotoPendencia(item._id, { mensagem: message });
      setItems((prev) => prev.filter((row) => row._id !== item._id));
      setDrafts((prev) => ({
        ...prev,
        [item._id]: {
          retornoGeoMar: '',
          retornoGeoLog: '',
        },
      }));
      setToast({
        type: 'success',
        message: 'Pendência concluída pela GeoMar',
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao concluir pendência',
      });
    } finally {
      setSavingId(null);
    }
  };

  const uploadDocumento = async (item, doc, files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const currentOwner = getPendenciaResponsavel(item);

    if (currentOwner !== userPendenciaGroup) {
      setToast({
        type: 'warning',
        message: `Esta pendência está com ${RESPONSAVEL_CONFIG[currentOwner].label}. Aguarde o repasse para anexar.`,
      });
      return;
    }

    const uploadKey = `${item._id}:${doc}`;
    setUploadingDoc(uploadKey);

    try {
      const res = await adminService.uploadCanhotoDocumento(item._id, doc, selected);
      const updated = res.data?.delivery || {};
      const remaining = updated.missingDocumentsAtSubmit || [];

      setItems((prev) =>
        prev.map((row) =>
          row._id === item._id
            ? {
                ...row,
                ...updated,
                missingDocumentsAtSubmit: remaining,
              }
            : row
        )
      );

      setToast({
        type: 'success',
        message:
          remaining.length === 0
            ? 'Todos os documentos foram anexados. Repasse para a GeoMar conferir e concluir.'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <button
                onClick={() => navigate('/home')}
                className="mt-0.5 w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-sm"
                title="Voltar"
              >
                <FaArrowLeft />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200">
                <FaClipboardList />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 border border-slate-200">
                    Painel administrativo
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 border border-amber-200">
                    Pendências documentais
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                  Documentos Pendentes
                </h1>
                <p className="text-sm sm:text-base text-slate-500 mt-1">
                  Acompanhe entregas finalizadas com documentos faltantes e registre retornos operacionais com mais clareza.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition',
                    viewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                  title="Visualizar em cards"
                >
                  <FaThLarge size={12} />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition',
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                  title="Visualizar em lista"
                >
                  <FaList size={12} />
                  Lista
                </button>
              </div>

              <div className="relative">
                <FaSearch
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={13}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar processo, motorista, retorno..."
                  className="w-full sm:w-96 pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 outline-none shadow-sm transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <button
                onClick={loadPendencias}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black transition shadow-sm"
              >
                <FaSync size={12} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <StatCard
              label="Com GeoMar"
              value={totalComGeoMar}
              icon={FaUser}
              tone="emerald"
              active={ownerFilter === 'geomar'}
              onClick={() => setOwnerFilter('geomar')}
            />
            <StatCard
              label="Com GeoLog"
              value={totalComGeoLog}
              icon={FaTruck}
              tone="blue"
              active={ownerFilter === 'geolog'}
              onClick={() => setOwnerFilter('geolog')}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <DeliveryCardSkeleton key={index} />
            ))}
          </div>
        )}

        {!loading && visibleItems.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-10 sm:p-14 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <FaCheckCircle size={28} />
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Nenhuma pendência encontrada
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto leading-relaxed">
              Não há entregas finalizadas com documentos faltantes para os filtros atuais.
            </p>
          </div>
        )}

        {!loading && visibleItems.length > 0 && viewMode === 'list' && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">
                    Lista estilo planilha
                  </p>
                  <h2 className="text-lg font-black text-slate-900">
                    {visibleItems.length} entrega{visibleItems.length === 1 ? '' : 's'} com documentos pendentes
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Inclui pendências com GeoMar e GeoLog.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {[
                      'Processo principal',
                      'Processo Log',
                      'Container',
                      'Recebedor',
                      'Agendamento',
                      'Contratado',
                      'Motorista',
                      'Responsável',
                      'Justificativa e último retorno',
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-[10px] uppercase tracking-[0.16em] font-black text-slate-500 border-r border-slate-200 last:border-r-0"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.map((item) => {
                    const scheduleInfo = getScheduleInfo(item, city);
                    const currentOwner = getPendenciaResponsavel(item);
                    const currentConfig = RESPONSAVEL_CONFIG[currentOwner];
                    const history = Array.isArray(item.pendenciaHistorico)
                      ? item.pendenciaHistorico
                      : [];
                    const lastHistory = history[history.length - 1];
                    const partyValue = item.recebedor || item.destinatario || item.remetente;
                    const containerValue = Array.isArray(item.containerNumero)
                      ? item.containerNumero.join(', ')
                      : item.container || item.deliveryNumber;
                    const justification = item.submissionObservation || item.documentsJustification || '';
                    const lastReturn = lastHistory?.message || '';

                    return (
                      <tr key={item._id} className="odd:bg-white even:bg-slate-50/70 hover:bg-amber-50/60 transition">
                        <td className="px-4 py-3 text-sm font-black text-slate-900 border-r border-slate-100 align-top">
                          {item.processoCAB || item.deliveryNumber || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700 border-r border-slate-100 align-top">
                          {item.processoLog || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700 border-r border-slate-100 align-top">
                          {containerValue || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700 border-r border-slate-100 align-top">
                          {partyValue || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100 align-top">
                          {scheduleInfo.value || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100 align-top">
                          {item.userName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100 align-top">
                          {item.driverName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm border-r border-slate-100 align-top">
                          <span className={cn(
                            'inline-flex rounded-full px-3 py-1 text-xs font-black border',
                            currentConfig.badge
                          )}>
                            {currentConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 align-top min-w-[280px] max-w-[420px]">
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {justification || 'Sem justificativa registrada.'}
                            {lastReturn && (
                              <div className="mt-2 text-xs text-slate-500">
                                <span className="font-black text-slate-700">Último retorno:</span> {lastReturn}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="hidden">
              {filteredItems.map((item) => {
                const pendingDocs = item.missingDocumentsAtSubmit || [];
                const scheduleInfo = getScheduleInfo(item, city);
                const currentOwner = getPendenciaResponsavel(item);
                const currentConfig = RESPONSAVEL_CONFIG[currentOwner];
                const CurrentIcon = currentConfig.icon;
                const history = Array.isArray(item.pendenciaHistorico)
                  ? item.pendenciaHistorico
                  : [];
                const lastHistory = history[history.length - 1];
                const partyValue = item.recebedor || item.destinatario || item.remetente;

                return (
                  <div key={item._id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition">
                    <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                      <div className="xl:w-72 min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black">
                          Processo principal
                        </p>
                        <h3 className="mt-1 text-lg font-black text-slate-900 break-words">
                          {item.processoCAB || item.deliveryNumber || '-'}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-200">
                            {formatDeliveryStatus(item.status)}
                          </span>
                          <span className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black border',
                            currentConfig.badge
                          )}>
                            <CurrentIcon size={10} />
                            {currentConfig.label}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4 flex-1 min-w-0">
                        <ListCell label="Processo Log" value={item.processoLog} />
                        <ListCell
                          label="Container"
                          value={Array.isArray(item.containerNumero) ? item.containerNumero.join(', ') : item.container || item.deliveryNumber}
                        />
                        <ListCell label={scheduleInfo.label} value={scheduleInfo.value} />
                        <ListCell label="Contratado" value={item.userName} />
                        <ListCell label="Motorista" value={item.driverName} />
                        <ListCell label={getPartyLabel(item, city)} value={partyValue} />
                        <ListCell label="Sentido" value={formatSentido(item.sentido)} />
                        <ListCell label="Armador" value={item.armador} />
                        <ListCell label="Atualizado em" value={item.retornosPendenciaUpdatedAt ? formatarData(item.retornosPendenciaUpdatedAt, city) : '-'} />
                        <ListCell label="Atualizado por" value={item.retornosPendenciaUpdatedBy} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-black mb-2">
                          Documentos pendentes
                        </p>
                        {pendingDocs.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {pendingDocs.map((doc) => (
                              <span key={doc} className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                                {getDocumentLabel(doc, city)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-emerald-700">
                            Nenhum documento pendente.
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black mb-2">
                          Justificativa e último retorno
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {item.submissionObservation || item.documentsJustification || 'Sem justificativa registrada.'}
                        </p>
                        {lastHistory && (
                          <p className="mt-2 text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">
                            <span className="font-black text-slate-700">Último retorno:</span>{' '}
                            {lastHistory.message || '-'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && filteredItems.length > 0 && viewMode === 'cards' && (
          <div className="space-y-5">
            {filteredItems.map((item) => {
              const draft = drafts[item._id] || {};
              const pendingDocs = item.missingDocumentsAtSubmit || [];
              const isSaving = savingId === item._id;
              const scheduleInfo = getScheduleInfo(item, city);
              const currentOwner = getPendenciaResponsavel(item);
              const currentConfig = RESPONSAVEL_CONFIG[currentOwner];
              const CurrentIcon = currentConfig.icon;
              const nextOwner = getNextResponsavel(currentOwner);
              const nextConfig = RESPONSAVEL_CONFIG[nextOwner];
              const isMyTurn = !isManagerViewOnly && currentOwner === userPendenciaGroup;
              const canConclude = isMyTurn && currentOwner === 'geomar' && pendingDocs.length === 0;
              const history = Array.isArray(item.pendenciaHistorico)
                ? item.pendenciaHistorico
                : [];

              return (
                <div
                  key={item._id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg"
                >
                  <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col 2xl:flex-row gap-6">
                      <div className="2xl:w-[42%] min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">
                              Processo principal
                            </p>
                            <h2 className="text-2xl font-black text-slate-900 break-words mt-1">
                              {item.processoCAB || item.deliveryNumber || '-'}
                            </h2>

                            {(item.processoLog || item.deliveryNumber) && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.processoLog && (
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                    Processo Log: {item.processoLog}
                                  </span>
                                )}
                                {item.deliveryNumber && (
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                    Delivery: {item.deliveryNumber}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-black border border-amber-200">
                              <FaExclamationTriangle size={11} />
                              {pendingDocs.length} pend.
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border',
                              currentConfig.badge
                            )}>
                              <CurrentIcon size={11} />
                              Com {currentConfig.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5">
                          <SectionTitle
                            icon={FaBoxes}
                            title="Informações da entrega"
                            subtitle="Dados operacionais principais"
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field
                              label="Container"
                              value={
                                Array.isArray(item.containerNumero)
                                  ? item.containerNumero.join(', ')
                                  : item.container || item.deliveryNumber
                              }
                              icon={FaBoxes}
                            />
                            <Field
                              label={scheduleInfo.label}
                              value={scheduleInfo.value}
                              icon={FaCalendarAlt}
                            />
                            <Field
                              label="Contratado"
                              value={item.userName}
                              icon={FaBuilding}
                            />
                            <Field
                              label="Motorista"
                              value={item.driverName}
                              icon={FaTruck}
                            />
                            <div className="md:col-span-2">
                              <Field
                                label={getPartyLabel(item, city)}
                                value={item.recebedor || item.destinatario || item.remetente}
                                icon={FaUser}
                              />
                            </div>
                          </div>
                        </div>

                        {(item.submissionObservation || item.documentsJustification) && (
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-xl bg-slate-200/70 text-slate-600 flex items-center justify-center">
                                <FaRegCommentDots size={13} />
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                                  Justificativa
                                </p>
                                <p className="text-sm font-black text-slate-800">
                                  Observação do motorista
                                </p>
                              </div>
                            </div>

                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {item.submissionObservation || item.documentsJustification}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="2xl:flex-1 min-w-0 space-y-5">
                        <div>
                          <SectionTitle
                            icon={FaFileUpload}
                            title="Documentos pendentes"
                            subtitle="Anexe os arquivos faltantes para concluir a pendência"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {pendingDocs.map((doc) => (
                              <PendingDocumentControl
                                key={doc}
                                doc={doc}
                                city={city}
                                disabled={uploadingDoc === `${item._id}:${doc}` || !isMyTurn}
                                disabledLabel={
                                  !isMyTurn
                                    ? `Com ${currentConfig.label}`
                                    : undefined
                                }
                                onUpload={(files) => uploadDocumento(item, doc, files)}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <SectionTitle
                            icon={FaRegCommentDots}
                            title="Passe e repasse"
                            subtitle={`A pendência está com ${currentConfig.label}`}
                          />

                          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                            <ReturnPanel
                              title={`Responder como ${currentConfig.label}`}
                              icon={currentConfig.icon}
                              value={item[currentConfig.field]}
                              draftValue={draft[currentConfig.field]}
                              onChange={(e) =>
                                updateDraft(item._id, currentConfig.field, e.target.value)
                              }
                              placeholder={
                                isMyTurn
                                  ? `Descreva a tratativa e repasse para ${nextConfig.label}...`
                                  : isManagerViewOnly
                                    ? 'Modo visualização para gerente.'
                                    : `Aguardando repasse para ${RESPONSAVEL_CONFIG[userPendenciaGroup]?.label || 'seu perfil'}...`
                              }
                              disabled={!isMyTurn || isSaving}
                              helper={
                                isMyTurn
                                  ? canConclude
                                    ? 'Revise os anexos e conclua a pendência para remover da tela.'
                                    : `Ao salvar, esta pendência sai da sua fila e vai para ${nextConfig.label}.`
                                  : isManagerViewOnly
                                    ? 'Perfil gerente acompanha a pendência sem alterar o fluxo.'
                                    : `Você consegue responder apenas quando a pendência estiver com ${RESPONSAVEL_CONFIG[userPendenciaGroup]?.label || 'seu perfil'}.`
                              }
                            />

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                                  <FaHistory size={14} />
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                                    Histórico
                                  </p>
                                  <h4 className="text-sm font-black text-slate-900">
                                    Últimos repasses
                                  </h4>
                                </div>
                              </div>

                              {history.length === 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                  Nenhum repasse registrado ainda.
                                </div>
                              ) : (
                                <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
                                  {history.slice().reverse().slice(0, 5).map((entry, index) => {
                                    const from = RESPONSAVEL_CONFIG[entry.from]?.label || '-';
                                    const to = RESPONSAVEL_CONFIG[entry.to]?.label || '-';
                                    const titleColor = entry.from === 'geomar' || entry.to === 'geomar'
                                      ? 'text-cyan-700'
                                      : entry.from === 'geolog' || entry.to === 'geolog'
                                        ? 'text-blue-700'
                                        : 'text-slate-500';
                                    const titleText = entry.action === 'documento_anexado'
                                      ? 'Documento'
                                      : `${from} para ${to}`;
                                    return (
                                      <div key={`${entry.createdAt || index}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                                          <span className={titleColor}>{titleText}</span>
                                          {entry.createdAt && <span>{formatarData(entry.createdAt, city)}</span>}
                                        </div>
                                        <p className="mt-1 text-sm font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed">
                                          {entry.message || '-'}
                                        </p>
                                        {entry.by && (
                                          <p className="mt-1 text-xs text-slate-400">
                                            por {entry.by}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                          <div className="text-sm text-slate-500 leading-relaxed">
                            {item.retornosPendenciaUpdatedAt ? (
                              <span>
                                <span className="font-bold text-slate-700">Última atualização:</span>{' '}
                                {formatarData(item.retornosPendenciaUpdatedAt, city)}
                                {item.retornosPendenciaUpdatedBy
                                  ? ` por ${item.retornosPendenciaUpdatedBy}`
                                  : ''}
                              </span>
                            ) : (
                              <span>Nenhum retorno salvo ainda.</span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            {canConclude && (
                              <button
                                onClick={() => saveRetornos(item)}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-black transition disabled:opacity-60 shadow-sm"
                              >
                                <FaExchangeAlt size={12} />
                                Repassar para GeoLog
                              </button>
                            )}

                            <button
                              onClick={() => canConclude ? concluirPendencia(item) : saveRetornos(item)}
                              disabled={isSaving || !isMyTurn}
                              className={cn(
                                'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-black transition disabled:opacity-60 shadow-sm',
                                canConclude
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : isMyTurn ? currentConfig.button : 'bg-slate-400 cursor-not-allowed'
                              )}
                            >
                              {isMyTurn ? (canConclude ? <FaCheckCircle size={12} /> : <FaExchangeAlt size={12} />) : <FaLock size={12} />}
                              {isSaving
                                ? canConclude ? 'Concluindo...' : 'Repassando...'
                                : canConclude
                                  ? 'Concluir pendência'
                                  : isMyTurn
                                  ? `Repassar para ${nextConfig.label}`
                                  : `Aguardando ${currentConfig.label}`}
                            </button>
                          </div>
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
