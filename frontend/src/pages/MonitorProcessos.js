// Instale caso ainda não tenha:
// npm install recharts

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useAuth } from '../services/authContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, RadialBarChart, RadialBar,
} from 'recharts';
import {
  FaPlus, FaTruck, FaBox, FaMapMarkerAlt, FaClock,
  FaCheckCircle, FaFileAlt, FaUndo, FaShippingFast,
  FaSync, FaLayerGroup, FaChevronRight, FaUser,
  FaBoxOpen, FaBuilding, FaCalendarAlt, FaChartBar,
  FaChartPie, FaChartLine, FaTachometerAlt,
  FaExclamationTriangle, FaThumbsUp,
} from 'react-icons/fa';

/* ══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DAS COLUNAS (igual ao componente anterior)
══════════════════════════════════════════════════════════════ */
const STATUS_COLUMNS = [
  {
    key: 'NOVO_PROCESSO', title: 'Novo Processo', description: 'Sem motorista',
    icon: FaPlus, gradient: 'from-blue-500 to-blue-600',
    lightBg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    filter: (p) => !p.motorista || p.motorista === '-' || p.motorista.trim() === '',
  },
  {
    key: 'PROGRAMADO', title: 'Programado', description: 'Agendado c/ motorista',
    icon: FaClock, gradient: 'from-violet-500 to-purple-600',
    lightBg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    filter: (p) => p.status === 'AGENDADO' && p.motorista && p.motorista !== '-',
  },
  {
    key: 'CNTR_COLETADO', title: 'CNTR Coletado', description: 'Container montado',
    icon: FaBox, gradient: 'from-emerald-500 to-green-600',
    lightBg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    filter: (p) => p.status === 'CONTAINER_MONTADO',
  },
  {
    key: 'INICIAR_VIAGEM', title: 'Em Viagem', description: 'A caminho do cliente',
    icon: FaTruck, gradient: 'from-orange-500 to-amber-600',
    lightBg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    filter: (p) => p.status === 'A_CAMINHO_DO_CLIENTE',
  },
  {
    key: 'CHEGADA_CLIENTE', title: 'No Cliente', description: 'Aguardando desova',
    icon: FaMapMarkerAlt, gradient: 'from-yellow-500 to-amber-500',
    lightBg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    filter: (p) => p.status === 'AGUARDANDO_DESOVA',
  },
  {
    key: 'OPERACAO_INICIADA', title: 'Em Desova', description: 'Operação iniciada',
    icon: FaShippingFast, gradient: 'from-rose-500 to-red-600',
    lightBg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    filter: (p) => p.status === 'EM_DESOVA',
  },
  {
    key: 'OPERACAO_FINALIZADA', title: 'Op. Finalizada', description: 'Desova concluida Anexando canhotos',
    icon: FaCheckCircle, gradient: 'from-teal-500 to-emerald-600',
    lightBg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700',
    filter: (p) => p.status === 'ANEXANDO_DOCUMENTOS_FINAIS',
  },
  {
    key: 'VIAGEM_RETORNO', title: 'Retorno', description: 'Pend. Devolução',
    icon: FaUndo, gradient: 'from-cyan-500 to-sky-600',
    lightBg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
    filter: (p) => p.status === 'FINALIZADO' && !p.containerReturned,
  },
  {
    key: 'CNTR_ENTREGUE', title: 'CNTR Entregue', description: 'Container devolvido',
    icon: FaCheckCircle, gradient: 'from-green-600 to-teal-700',
    lightBg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    filter: (p) => p.status === 'ENTREGUE_COM_PENDENCIA_CANHOTO',
  },
];

/* ══════════════════════════════════════════════════════════════
   HELPERS DE MÉTRICAS
══════════════════════════════════════════════════════════════ */

/**
 * Calcula quantos minutos decorram entre duas datas ISO.
 * Retorna null se alguma das datas for inválida.
 */
const diffMinutes = (start, end) => {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  return ms > 0 ? ms / 60000 : null;
};

const formatDuration = (minutes) => {
  if (minutes == null || isNaN(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

/**
 * Constrói os dados para o gráfico de tempo médio por status.
 * Usa os campos: createdAt, scheduledAt, collectedAt, departedAt,
 * arrivedAt, desovaStartAt, desovaEndAt, docsAt, returnedAt, deliveredAt
 * — adapte conforme os campos reais do seu backend.
 */
const buildTempoMedioData = (programacoes) => {
  const stages = [
    {
      label: 'Agendamento',
      shortLabel: 'Agend.',
      color: '#8b5cf6',
      fn: (p) => diffMinutes(p.createdAt, p.scheduledAt ?? p.dataAgendamento),
    },
    {
      label: 'Coleta CNTR',
      shortLabel: 'Coleta',
      color: '#10b981',
      fn: (p) => diffMinutes(p.scheduledAt ?? p.dataAgendamento, p.collectedAt),
    },
    {
      label: 'Viagem',
      shortLabel: 'Viagem',
      color: '#f59e0b',
      fn: (p) => diffMinutes(p.collectedAt, p.arrivedAt),
    },
    {
      label: 'Espera Desova',
      shortLabel: 'Espera',
      color: '#ef4444',
      fn: (p) => diffMinutes(p.arrivedAt, p.desovaStartAt),
    },
    {
      label: 'Desova',
      shortLabel: 'Desova',
      color: '#f97316',
      fn: (p) => diffMinutes(p.desovaStartAt, p.desovaEndAt),
    },
    {
      label: 'Documentação',
      shortLabel: 'Docs',
      color: '#6366f1',
      fn: (p) => diffMinutes(p.desovaEndAt, p.docsAt),
    },
    {
      label: 'Retorno',
      shortLabel: 'Retorno',
      color: '#06b6d4',
      fn: (p) => diffMinutes(p.docsAt, p.deliveredAt),
    },
  ];

  return stages.map(({ label, shortLabel, color, fn }) => {
    const values = programacoes.map(fn).filter((v) => v !== null && !isNaN(v));
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { label, shortLabel, color, avg: Math.round(avg), count: values.length };
  });
};

/** Distribuição por status para o Pie chart */
const buildDistribuicaoData = (programacoes) => {
  const map = {};
  programacoes.forEach((p) => {
    const s = p.status || 'SEM_STATUS';
    map[s] = (map[s] || 0) + 1;
  });

  const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#f97316','#06b6d4','#6366f1','#14b8a6','#22c55e'];
  return Object.entries(map).map(([status, value], i) => ({
    name: status.replace(/_/g, ' '),
    value,
    color: COLORS[i % COLORS.length],
  }));
};

/** Taxa de sucesso x em andamento x sem motorista */
const buildTaxaData = (programacoes) => {
  const total = programacoes.length || 1;
  const finalizados = programacoes.filter(
    (p) => p.status === 'FINALIZADO' || p.status === 'ENTREGUE'
  ).length;
  const emAndamento = programacoes.filter((p) =>
    ['A_CAMINHO_DO_CLIENTE','AGUARDANDO_DESOVA','EM_DESOVA','EM_ROTA'].includes(p.status)
  ).length;
  const semMotorista = programacoes.filter(
    (p) => !p.motorista || p.motorista === '-' || p.motorista.trim() === ''
  ).length;
  const outros = total - finalizados - emAndamento - semMotorista;

  return [
    { name: 'Finalizados',    value: finalizados,  pct: ((finalizados / total) * 100).toFixed(1),   color: '#10b981' },
    { name: 'Em Andamento',   value: emAndamento,  pct: ((emAndamento / total) * 100).toFixed(1),   color: '#f59e0b' },
    { name: 'Sem Motorista',  value: semMotorista, pct: ((semMotorista / total) * 100).toFixed(1),  color: '#ef4444' },
    { name: 'Outros',         value: Math.max(0, outros), pct: ((Math.max(0, outros) / total) * 100).toFixed(1), color: '#94a3b8' },
  ];
};

/** Evolução diária dos últimos 7 dias */
const buildEvolucaoDiariaData = (programacoes) => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  return days.map((day) => {
    const criados = programacoes.filter((p) => (p.createdAt || '').startsWith(day)).length;
    const finalizados = programacoes.filter(
      (p) =>
        (p.deliveredAt || p.updatedAt || '').startsWith(day) &&
        (p.status === 'FINALIZADO' || p.status === 'ENTREGUE')
    ).length;
    const label = new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit',
    });
    return { label, criados, finalizados };
  });
};

/* ══════════════════════════════════════════════════════════════
   CUSTOM TOOLTIP (Recharts)
══════════════════════════════════════════════════════════════ */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-bold text-gray-800">
            {entry.name?.toLowerCase().includes('tempo') || entry.dataKey === 'avg'
              ? formatDuration(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-gray-600">
        Tempo médio:{' '}
        <span className="font-bold text-gray-800">{formatDuration(payload[0]?.value)}</span>
      </p>
      <p className="text-gray-400 text-xs">{payload[0]?.payload?.count} processos medidos</p>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   SEÇÃO DE GRÁFICOS
══════════════════════════════════════════════════════════════ */
const DashboardSection = ({ programacoes }) => {
  const tempoMedioData  = useMemo(() => buildTempoMedioData(programacoes),   [programacoes]);
  const taxaData        = useMemo(() => buildTaxaData(programacoes),          [programacoes]);
  const distribuicao    = useMemo(() => buildDistribuicaoData(programacoes),  [programacoes]);
  const evolucao        = useMemo(() => buildEvolucaoDiariaData(programacoes),[programacoes]);

  const total           = programacoes.length;
  const txConclusao     = total ? (taxaData[0].value / total * 100).toFixed(0) : 0;
  const txAndamento     = total ? (taxaData[1].value / total * 100).toFixed(0) : 0;
  const txAlerta        = total ? (taxaData[2].value / total * 100).toFixed(0) : 0;

  /* ─ KPI bar rápida ─ */
  const kpis = [
    {
      label: 'Taxa de Conclusão',
      value: `${txConclusao}%`,
      sub: `${taxaData[0].value} finalizados`,
      icon: FaThumbsUp,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      barColor: 'bg-emerald-500',
      bar: Number(txConclusao),
    },
    {
      label: 'Em Operação',
      value: `${txAndamento}%`,
      sub: `${taxaData[1].value} em andamento`,
      icon: FaTachometerAlt,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      barColor: 'bg-amber-400',
      bar: Number(txAndamento),
    },
    {
      label: 'Alerta: Sem Motorista',
      value: `${txAlerta}%`,
      sub: `${taxaData[2].value} aguardando`,
      icon: FaExclamationTriangle,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      barColor: 'bg-rose-500',
      bar: Number(txAlerta),
    },
  ];

  return (
    <section className="mb-8 space-y-5">
      {/* ── Título da seção ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
          <FaChartBar className="text-white text-sm" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800">Analytics & Performance</h2>
          <p className="text-xs text-gray-400">Baseado em {total} processo{total !== 1 ? 's' : ''} carregados</p>
        </div>
      </div>

      {/* ── Linha 1: 3 KPI cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`${k.iconBg} p-2.5 rounded-xl`}>
                <k.icon className={`${k.iconColor} text-lg`} />
              </div>
              <span className="text-3xl font-extrabold text-gray-800">{k.value}</span>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-0.5">{k.label}</p>
            <p className="text-xs text-gray-400 mb-3">{k.sub}</p>
            {/* Mini progress bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${k.barColor} rounded-full transition-all duration-700`}
                style={{ width: `${Math.min(k.bar, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Linha 2: Tempo médio por etapa + Distribuição por status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Gráfico de Barras Horizontal — Tempo médio por etapa */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FaChartBar className="text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-gray-800">Tempo Médio por Etapa</h3>
              <p className="text-xs text-gray-400">Média de minutos em cada fase do processo</p>
            </div>
          </div>

          {tempoMedioData.every((d) => d.avg === 0) ? (
            <EmptyChart message="Dados de timestamps não disponíveis para calcular tempos" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={tempoMedioData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatDuration}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={18}>
                  {tempoMedioData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut — Taxa de sucesso/erro */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FaChartPie className="text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-gray-800">Taxa de Sucesso / Alerta</h3>
              <p className="text-xs text-gray-400">Distribuição atual dos processos</p>
            </div>
          </div>

          {total === 0 ? (
            <EmptyChart message="Nenhum processo carregado" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={taxaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {taxaData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }}
                  />
                  {/* Label central */}
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                    className="fill-gray-800" style={{ fontSize: 22, fontWeight: 800 }}>
                    {txConclusao}%
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 10, fill: '#94a3b8' }}>
                    concluídos
                  </text>
                </PieChart>
              </ResponsiveContainer>

              {/* Legenda manual */}
              <div className="space-y-2 mt-1">
                {taxaData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{d.value}</span>
                      <span className="text-gray-400 w-10 text-right">{d.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Linha 3: Evolução diária + Distribuição granular ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Area chart — Evolução diária */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FaChartLine className="text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-gray-800">Evolução Diária</h3>
                <p className="text-xs text-gray-400">Processos criados vs finalizados (últimos 7 dias)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> Criados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Finalizados
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={evolucao} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCriados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradFinalizados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="criados"    name="Criados"    stroke="#3b82f6" strokeWidth={2} fill="url(#gradCriados)"     dot={{ r: 3, fill: '#3b82f6' }} />
              <Area type="monotone" dataKey="finalizados" name="Finalizados" stroke="#10b981" strokeWidth={2} fill="url(#gradFinalizados)" dot={{ r: 3, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Barras empilhadas — Distribuição por status */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FaLayerGroup className="text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-gray-800">Distribuição por Status</h3>
              <p className="text-xs text-gray-400">Volume em cada etapa</p>
            </div>
          </div>

          {total === 0 ? (
            <EmptyChart message="Nenhum processo carregado" />
          ) : (
            <div className="space-y-2">
              {distribuicao
                .sort((a, b) => b.value - a.value)
                .slice(0, 8)
                .map((d) => (
                  <div key={d.name} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 truncate max-w-[120px]">{d.name}</span>
                      <span className="font-bold text-gray-800 ml-2">{d.value}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(d.value / total) * 100}%`,
                          background: d.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

/* ══════════════════════════════════════════════════════════════
   ESTADO VAZIO DO GRÁFICO
══════════════════════════════════════════════════════════════ */
const EmptyChart = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-[150px] text-gray-300 gap-2">
    <FaChartBar className="text-3xl" />
    <p className="text-xs text-center max-w-[180px]">{message}</p>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   KANBAN — Process Card
══════════════════════════════════════════════════════════════ */
const ProcessCard = ({ process, column }) => (
  <div className={`group relative bg-white rounded-xl border ${column.border} shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer overflow-hidden`}>
    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${column.gradient}`} />
    <div className="pl-4 pr-3 pt-3 pb-3">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className="font-bold text-gray-800 text-sm leading-tight truncate">
          {process.processo || '—'}
        </span>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${column.badge} border ${column.border}`}>
          {process.container || 'N/A'}
        </span>
      </div>
      <div className="space-y-1.5">
        {process.recebedor && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <FaBuilding className="text-gray-400 shrink-0" />
            <span className="truncate">{process.recebedor}</span>
          </div>
        )}
        {process.contratado && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <FaBoxOpen className="text-gray-400 shrink-0" />
            <span className="truncate">{process.contratado}</span>
          </div>
        )}
        {process.motorista && process.motorista !== '-' && (
          <div className={`flex items-center gap-1.5 text-[11px] font-medium ${column.text}`}>
            <FaUser className="shrink-0" />
            <span className="truncate">{process.motorista}</span>
          </div>
        )}
        {process.dataAgendamento && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <FaCalendarAlt className="shrink-0" />
            <span>{process.dataAgendamento}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   KANBAN — Column Header + Column
══════════════════════════════════════════════════════════════ */
const ColumnHeader = ({ column, count }) => {
  const Icon = column.icon;
  return (
    <div className={`px-4 py-3 ${column.lightBg} border-b ${column.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${column.gradient} flex items-center justify-center shadow-sm`}>
            <Icon className="text-white text-sm" />
          </div>
          <div>
            <p className={`text-sm font-bold ${column.text} leading-tight`}>{column.title}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{column.description}</p>
          </div>
        </div>
        <span className={`min-w-[26px] h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center bg-gradient-to-br ${column.gradient} text-white shadow-sm`}>
          {count}
        </span>
      </div>
    </div>
  );
};

const KanbanColumn = ({ column, processes }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? processes : processes.slice(0, 4);
  return (
    <div className={`flex flex-col rounded-2xl border ${column.border} bg-white shadow-sm overflow-hidden min-w-[220px] max-w-[260px] flex-shrink-0`}>
      <ColumnHeader column={column} count={processes.length} />
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[460px]">
        {processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300">
            <column.icon className="text-3xl mb-2" />
            <p className="text-xs font-medium">Nenhum processo</p>
          </div>
        ) : (
          <>
            {visible.map((process) => (
              <ProcessCard key={process._id || process.processo} process={process} column={column} />
            ))}
            {processes.length > 4 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full text-xs font-semibold py-2 rounded-lg ${column.lightBg} ${column.text} border ${column.border} hover:opacity-80 transition-opacity flex items-center justify-center gap-1`}
              >
                {expanded ? 'Ver menos' : `+${processes.length - 4} mais processos`}
                <FaChevronRight className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   STATS BAR (4 KPIs topo)
══════════════════════════════════════════════════════════════ */
const StatsBar = ({ programacoes }) => {
  const total       = programacoes.length;
  const ativos      = programacoes.filter((p) => ['A_CAMINHO_DO_CLIENTE','AGUARDANDO_DESOVA','EM_DESOVA','EM_ROTA'].includes(p.status)).length;
  const finalizados = programacoes.filter((p) => ['FINALIZADO','ENTREGUE'].includes(p.status)).length;
  const semMotorista= programacoes.filter((p) => !p.motorista || p.motorista === '-' || p.motorista.trim() === '').length;

  const stats = [
    { label: 'Total de Processos', value: total,        icon: FaLayerGroup,         color: 'text-blue-600',    bg: 'bg-blue-50'   },
    { label: 'Em Andamento',       value: ativos,       icon: FaTruck,              color: 'text-orange-600',  bg: 'bg-orange-50' },
    { label: 'Finalizados',        value: finalizados,  icon: FaCheckCircle,        color: 'text-emerald-600', bg: 'bg-emerald-50'},
    { label: 'Sem Motorista',      value: semMotorista, icon: FaExclamationTriangle, color: 'text-rose-600',   bg: 'bg-rose-50'   },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className={`${s.bg} p-3 rounded-xl`}>
            <s.icon className={`${s.color} text-xl`} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */
const MonitorProcessos = () => {
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [programacoes, setProgramacoes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [activeTab,    setActiveTab]    = useState('kanban'); // 'kanban' | 'analytics'

  useEffect(() => {
    if (!user) return;
    if (!['manager','admin','geomar'].includes(user.role)) { navigate('/home'); return; }
    loadProgramacoes();
  }, [user, navigate]);

  const loadProgramacoes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminService.getProgramacoes();
      let data = [];
      if (response?.data?.programacoes && Array.isArray(response.data.programacoes)) data = response.data.programacoes;
      else if (Array.isArray(response?.data))                                          data = response.data;
      else if (response?.programacoes && Array.isArray(response.programacoes))         data = response.programacoes;
      setProgramacoes(data);
      setLastUpdate(new Date());
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      setToast({ message: 'Erro ao carregar: ' + msg, type: 'error' });
      setProgramacoes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getProcesses = (filterFn) => {
    if (!Array.isArray(programacoes) || typeof filterFn !== 'function') return [];
    try { return programacoes.filter(filterFn); } catch { return []; }
  };

  /* ─ Loading screen ─ */
  if (!user || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg">
            <FaSync className="animate-spin text-white text-2xl" />
          </div>
          <p className="text-lg font-semibold text-gray-700">
            {!user ? 'Verificando permissões...' : 'Carregando processos...'}
          </p>
          <p className="text-sm text-gray-400">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  if (!['manager','admin','geomar'].includes(user.role)) { navigate('/home'); return null; }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Toast toast={toast} setToast={setToast} />

      {/* ── Header fixo ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          {/* Logo + título */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
              <FaLayerGroup className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Monitor de Processos
              </h1>
              <p className="text-xs text-gray-400">
                {lastUpdate ? `Atualizado às ${lastUpdate.toLocaleTimeString('pt-BR')}` : 'Acompanhe em tempo real'}
              </p>
            </div>
          </div>

          {/* Tabs + botão */}
          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1 gap-1">
              {[
                { id: 'analytics', label: 'Analytics', icon: FaChartBar },
                { id: 'kanban',    label: 'Kanban',    icon: FaLayerGroup },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                    transition-all duration-200
                    ${activeTab === tab.id
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}
                  `}
                >
                  <tab.icon className="text-xs" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{programacoes.length} processos</span>
            </div>

            <button
              onClick={loadProgramacoes}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* ── Corpo ── */}
      <div className="px-6 py-6">

        {/* Analytics section */}
        {activeTab === 'analytics' && (
          <>
            {/* KPIs topo */}
            <StatsBar programacoes={programacoes} />
            <DashboardSection programacoes={programacoes} />
          </>
        )}

        {/* Kanban Board */}
        {activeTab === 'kanban' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <FaLayerGroup className="text-white text-sm" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">Board de Processos</h2>
                <p className="text-xs text-gray-400">{STATUS_COLUMNS.length} etapas · Scroll horizontal para ver todas</p>
              </div>
            </div>
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                {STATUS_COLUMNS.map((column) => (
                  <KanbanColumn key={column.key} column={column} processes={getProcesses(column.filter)} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="text-center text-xs text-gray-400 pb-8">
        {STATUS_COLUMNS.length} etapas · {programacoes.length} processos no total
      </div>
    </div>
  );
};

export default MonitorProcessos;
