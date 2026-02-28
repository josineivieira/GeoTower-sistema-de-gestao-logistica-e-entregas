import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

/* ─────────────────────────────────────────
   UTILITÁRIOS COMPARTILHADOS
───────────────────────────────────────── */

/** Formata minutos → "Xh Ym" ou "Ym" */
export const formatMinutes = (m) => {
  if (m == null || isNaN(m)) return '-';
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

/** Retorna label do período */
export const periodLabel = (period) =>
  ({ day: 'Hoje', week: 'Esta Semana', month: 'Este Mês' }[period] ?? period);

/** Captura um elemento DOM como base64 PNG via html2canvas */
const captureElement = async (element) => {
  if (!element) return null;
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

/** Converte hex #rrggbb → [r, g, b] */
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

/* ─────────────────────────────────────────
   PDF — helpers de layout
───────────────────────────────────────── */

const BRAND_COLOR    = '#4f46e5'; // indigo-600
const BRAND_DARK     = '#1e1b4b'; // indigo-950
const ACCENT_COLOR   = '#06b6d4'; // cyan-500
const GRAY_LIGHT     = '#f8fafc';
const GRAY_BORDER    = '#e2e8f0';
const TEXT_PRIMARY   = '#1e293b';
const TEXT_SECONDARY = '#64748b';
const PAGE_W         = 210; // A4 mm
const MARGIN         = 14;
const CONTENT_W      = PAGE_W - MARGIN * 2;

/**
 * Desenha o cabeçalho fixo em cada página
 * @param {jsPDF} doc
 * @param {number} pageNumber
 * @param {number} totalPages  (use 0 quando ainda não souber)
 */
const drawPageHeader = (doc, pageNumber, title = 'Dashboard de Indicadores') => {
  // Faixa de cor
  doc.setFillColor(...hexToRgb(BRAND_DARK));
  doc.rect(0, 0, PAGE_W, 16, 'F');

  // Linha accent
  doc.setFillColor(...hexToRgb(BRAND_COLOR));
  doc.rect(0, 16, PAGE_W, 1.5, 'F');

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN, 10.5);

  // Página
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text(`Página ${pageNumber}`, PAGE_W - MARGIN, 10.5, { align: 'right' });
};

/**
 * Desenha o rodapé em cada página
 */
const drawPageFooter = (doc, generatedAt) => {
  const y = 292;
  doc.setFillColor(...hexToRgb(GRAY_BORDER));
  doc.rect(0, y - 1, PAGE_W, 0.4, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...hexToRgb(TEXT_SECONDARY));
  doc.text(`Gerado em ${generatedAt}`, MARGIN, y + 4);
  doc.text('Relatório Confidencial — Uso Interno', PAGE_W - MARGIN, y + 4, { align: 'right' });
};

/**
 * Adiciona nova página com cabeçalho/rodapé e retorna o y inicial de conteúdo
 */
const addPage = (doc, pageRef, title, generatedAt) => {
  doc.addPage();
  pageRef.current++;
  drawPageHeader(doc, pageRef.current, title);
  drawPageFooter(doc, generatedAt);
  return 26; // y inicial após header
};

/**
 * Verifica se há espaço suficiente; se não, adiciona nova página
 */
const ensureSpace = (doc, y, needed, pageRef, title, generatedAt) => {
  if (y + needed > 285) {
    return addPage(doc, pageRef, title, generatedAt);
  }
  return y;
};

/** Desenha um card KPI simples no PDF */
const drawKpiCard = (doc, x, y, w, h, label, value, color) => {
  // Fundo branco com borda
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...hexToRgb(GRAY_BORDER));
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Barra lateral colorida
  doc.setFillColor(...hexToRgb(color));
  doc.roundedRect(x, y, 2.5, h, 1, 1, 'F');

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(TEXT_SECONDARY));
  doc.text(label.toUpperCase(), x + 6, y + 7);

  // Valor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...hexToRgb(color));
  doc.text(String(value), x + 6, y + h - 5);
};

/** Título de seção */
const drawSectionTitle = (doc, y, text) => {
  doc.setFillColor(...hexToRgb(GRAY_LIGHT));
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setFillColor(...hexToRgb(BRAND_COLOR));
  doc.rect(MARGIN, y, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(TEXT_PRIMARY));
  doc.text(text, MARGIN + 6, y + 5.5);
  return y + 12;
};

/* ─────────────────────────────────────────
   EXPORTAR PARA PDF
───────────────────────────────────────── */

/**
 * @param {Object} payload
 * @param {Object} payload.statistics        - dados do back-end
 * @param {Array}  payload.deliveries        - lista de entregas
 * @param {Array}  payload.topRecebedores    - [{recebedor, count}]
 * @param {Object} payload.avgCliByRecebedor - {recebedor: avgMin}
 * @param {Array}  payload.recebedorCountData
 * @param {Array}  payload.recebedorAvgData
 * @param {string} payload.period
 * @param {Object} payload.chartRefs         - { area, barDriver, barReceiver, barCli, table }
 * @param {Function} payload.fmtMin          - formatMinutes
 */
export const exportToPDF = async (payload) => {
  const {
    statistics,
    deliveries,
    topRecebedores,
    avgCliByRecebedor,
    recebedorCountData,
    recebedorAvgData,
    period,
    chartRefs,
    fmtMin,
  } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generatedAt = new Date().toLocaleString('pt-BR');
  const period_label = periodLabel(period);
  const pageRef = { current: 1 };

  /* ── Captura gráficos em paralelo ── */
  const [imgArea, imgBarDriver, imgBarReceiver, imgBarCli] = await Promise.all([
    captureElement(chartRefs.area?.current),
    captureElement(chartRefs.barDriver?.current),
    captureElement(chartRefs.barReceiver?.current),
    captureElement(chartRefs.barCli?.current),
  ]);

  /* ══════════════════════════════════════
     PÁGINA 1 — CAPA
  ══════════════════════════════════════ */
  // Fundo degradê simulado (retângulos)
  doc.setFillColor(...hexToRgb(BRAND_DARK));
  doc.rect(0, 0, PAGE_W, 80, 'F');
  doc.setFillColor(...hexToRgb(BRAND_COLOR));
  doc.rect(0, 78, PAGE_W, 3, 'F');

  // Padrão decorativo (círculos sutis)
  doc.setFillColor(79, 70, 229); // indigo ligeiramente diferente
  doc.circle(190, 15, 40, 'F');
  doc.setFillColor(99, 102, 241);
  doc.circle(20, 65, 25, 'F');

  // Logo / ícone placeholder
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, 20, 14, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(BRAND_COLOR));
  doc.text('DB', MARGIN + 3.2, 30);

  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text('Dashboard de', MARGIN, 50);
  doc.text('Indicadores', MARGIN, 62);

  // Subtítulo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 190, 230);
  doc.text('Relatório de Análise Operacional', MARGIN, 72);

  // Metadados da capa
  const metaY = 92;
  const metaItems = [
    ['Período', period_label],
    ['Gerado em', generatedAt],
    ['Total de Entregas', String(statistics?.totalDeliveries ?? 0)],
    ['Motoristas Ativos', String(statistics?.deliveriesByDriver?.length ?? 0)],
  ];

  metaItems.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (CONTENT_W / 2 + 4);
    const y = metaY + row * 14;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...hexToRgb(GRAY_BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, CONTENT_W / 2 - 2, 11, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(TEXT_SECONDARY));
    doc.text(label, x + 4, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(TEXT_PRIMARY));
    doc.text(value, x + 4, y + 9);
  });

  // Rodapé da capa
  drawPageFooter(doc, generatedAt);

  /* ══════════════════════════════════════
     PÁGINA 2 — KPIs + GRÁFICO DE ÁREA
  ══════════════════════════════════════ */
  let page2Y = addPage(doc, pageRef, 'Dashboard de Indicadores', generatedAt);

  // Seção KPIs
  page2Y = drawSectionTitle(doc, page2Y, 'Indicadores-Chave de Desempenho (KPIs)');

  const kpiCards = [
    { label: 'Total de Entregas', value: statistics?.totalDeliveries ?? 0, color: BRAND_COLOR },
    { label: 'Motoristas Ativos',  value: statistics?.deliveriesByDriver?.length ?? 0, color: ACCENT_COLOR },
    { label: 'Top Recebedor',      value: topRecebedores[0]?.count ?? 0, color: '#f59e0b' },
    { label: 'Recebedores Únicos', value: Object.keys(avgCliByRecebedor).length, color: '#10b981' },
  ];

  const kpiW = (CONTENT_W - 9) / 4;
  kpiCards.forEach((k, i) => {
    drawKpiCard(doc, MARGIN + i * (kpiW + 3), page2Y, kpiW, 26, k.label, k.value, k.color);
  });
  page2Y += 32;

  // Gráfico de área — Evolução Diária
  if (imgArea) {
    page2Y = ensureSpace(doc, page2Y, 12, pageRef, 'Dashboard de Indicadores', generatedAt);
    page2Y = drawSectionTitle(doc, page2Y, 'Evolução Diária de Entregas');
    const chartH = 70;
    page2Y = ensureSpace(doc, page2Y, chartH, pageRef, 'Dashboard de Indicadores', generatedAt);
    doc.setDrawColor(...hexToRgb(GRAY_BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, page2Y, CONTENT_W, chartH, 2, 2, 'D');
    doc.addImage(imgArea, 'PNG', MARGIN + 1, page2Y + 1, CONTENT_W - 2, chartH - 2);
    page2Y += chartH + 6;
  }

  // Tabela — Entregas por Dia
  if (statistics?.dailyDeliveries?.length) {
    page2Y = ensureSpace(doc, page2Y, 12, pageRef, 'Dashboard de Indicadores', generatedAt);
    page2Y = drawSectionTitle(doc, page2Y, 'Dados — Entregas por Dia');

    autoTable(doc, {
      startY: page2Y,
      head: [['Data', 'Quantidade de Entregas']],
      body: statistics.dailyDeliveries.map((d) => {
        const parts = String(d._id).split('-');
        const dateLabel =
          parts.length === 3
            ? new Date(+parts[0], +parts[1] - 1, +parts[2]).toLocaleDateString('pt-BR')
            : d._id;
        return [dateLabel, d.count];
      }),
      headStyles: {
        fillColor: hexToRgb(BRAND_DARK),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, textColor: hexToRgb(TEXT_PRIMARY) },
      alternateRowStyles: { fillColor: hexToRgb(GRAY_LIGHT) },
      columnStyles: { 1: { halign: 'center' } },
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: hexToRgb(GRAY_BORDER),
      tableLineWidth: 0.2,
      didDrawPage: () => {
        drawPageHeader(doc, ++pageRef.current);
        drawPageFooter(doc, generatedAt);
      },
    });

    page2Y = doc.lastAutoTable.finalY + 8;
  }

  /* ══════════════════════════════════════
     PÁGINA 3 — ENTREGAS POR CONTRATADO
  ══════════════════════════════════════ */
  let page3Y = addPage(doc, pageRef, 'Dashboard de Indicadores', generatedAt);

  if (imgBarDriver) {
    page3Y = drawSectionTitle(doc, page3Y, 'Entregas por Contratado');
    const chartH = 80;
    doc.setDrawColor(...hexToRgb(GRAY_BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, page3Y, CONTENT_W, chartH, 2, 2, 'D');
    doc.addImage(imgBarDriver, 'PNG', MARGIN + 1, page3Y + 1, CONTENT_W - 2, chartH - 2);
    page3Y += chartH + 8;
  }

  if (statistics?.deliveriesByDriver?.length) {
    page3Y = ensureSpace(doc, page3Y, 12, pageRef, 'Dashboard de Indicadores', generatedAt);
    page3Y = drawSectionTitle(doc, page3Y, 'Dados — Entregas por Contratado');

    autoTable(doc, {
      startY: page3Y,
      head: [['Contratado', 'Entregas', '% do Total']],
      body: statistics.deliveriesByDriver.map((d) => {
        const pct =
          statistics.totalDeliveries > 0
            ? ((d.count / statistics.totalDeliveries) * 100).toFixed(1) + '%'
            : '-';
        return [d._id, d.count, pct];
      }),
      headStyles: {
        fillColor: hexToRgb(BRAND_DARK),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, textColor: hexToRgb(TEXT_PRIMARY) },
      alternateRowStyles: { fillColor: hexToRgb(GRAY_LIGHT) },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: hexToRgb(GRAY_BORDER),
      tableLineWidth: 0.2,
      didDrawPage: () => {
        drawPageHeader(doc, ++pageRef.current);
        drawPageFooter(doc, generatedAt);
      },
    });

    page3Y = doc.lastAutoTable.finalY + 8;
  }

  /* ══════════════════════════════════════
     PÁGINA 4 — RECEBEDORES + CLI
  ══════════════════════════════════════ */
  let page4Y = addPage(doc, pageRef, 'Dashboard de Indicadores', generatedAt);

  // Gráficos lado a lado
  const halfW = (CONTENT_W - 4) / 2;
  const chartH4 = 72;

  if (imgBarReceiver) {
    page4Y = drawSectionTitle(doc, page4Y, 'Recebedores & Tempo Médio CLI');
    doc.setDrawColor(...hexToRgb(GRAY_BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, page4Y, halfW, chartH4, 2, 2, 'D');
    doc.addImage(imgBarReceiver, 'PNG', MARGIN + 1, page4Y + 1, halfW - 2, chartH4 - 2);
  }
  if (imgBarCli) {
    doc.setDrawColor(...hexToRgb(GRAY_BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN + halfW + 4, page4Y, halfW, chartH4, 2, 2, 'D');
    doc.addImage(imgBarCli, 'PNG', MARGIN + halfW + 5, page4Y + 1, halfW - 2, chartH4 - 2);
  }

  if (imgBarReceiver || imgBarCli) page4Y += chartH4 + 8;

  // Tabela de Ranking
  if (topRecebedores.length > 0) {
    page4Y = ensureSpace(doc, page4Y, 12, pageRef, 'Dashboard de Indicadores', generatedAt);
    page4Y = drawSectionTitle(doc, page4Y, 'Ranking de Recebedores');

    const total = topRecebedores.reduce((s, r) => s + r.count, 0);

    autoTable(doc, {
      startY: page4Y,
      head: [['Pos.', 'Recebedor', 'Entregas', 'Tempo Médio CLI', '% do Total']],
      body: topRecebedores.map((r, i) => {
        const pct = total > 0 ? ((r.count / total) * 100).toFixed(1) + '%' : '-';
        const avg = avgCliByRecebedor[r.recebedor];
        return [`${i + 1}º`, r.recebedor, r.count, fmtMin(avg), pct];
      }),
      headStyles: {
        fillColor: hexToRgb(BRAND_DARK),
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, textColor: hexToRgb(TEXT_PRIMARY) },
      alternateRowStyles: { fillColor: hexToRgb(GRAY_LIGHT) },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
      // Medalhas nas 3 primeiras linhas
      willDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const colors = [
            [251, 191, 36],  // ouro
            [148, 163, 184], // prata
            [180, 120, 60],  // bronze
          ];
          const c = colors[data.row.index];
          if (c) {
            doc.setFillColor(...c);
            doc.roundedRect(
              data.cell.x + 2,
              data.cell.y + 1.5,
              data.cell.width - 4,
              data.cell.height - 3,
              1, 1, 'F'
            );
            doc.setTextColor(255, 255, 255);
          }
        }
      },
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: hexToRgb(GRAY_BORDER),
      tableLineWidth: 0.2,
      didDrawPage: () => {
        drawPageHeader(doc, ++pageRef.current);
        drawPageFooter(doc, generatedAt);
      },
    });
  }

  /* ── Salva ── */
  const fileName = `dashboard_${period}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  return fileName;
};

/* ─────────────────────────────────────────
   EXPORTAR PARA EXCEL
───────────────────────────────────────── */

/** Aplica estilo a um range de células */
const styleRange = (ws, range, style) => {
  const decode = XLSX.utils.decode_range(range);
  for (let R = decode.s.r; R <= decode.e.r; R++) {
    for (let C = decode.s.c; C <= decode.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = style;
    }
  }
};

/** Estilos reutilizáveis */
const STYLE = {
  headerDark: {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
    fill: { fgColor: { rgb: '1E1B4B' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'thin', color: { rgb: '4F46E5' } },
      bottom: { style: 'thin', color: { rgb: '4F46E5' } },
      left:   { style: 'thin', color: { rgb: '4F46E5' } },
      right:  { style: 'thin', color: { rgb: '4F46E5' } },
    },
  },
  headerAccent: {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
    fill: { fgColor: { rgb: '4F46E5' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top:    { style: 'thin', color: { rgb: '6366F1' } },
      bottom: { style: 'thin', color: { rgb: '6366F1' } },
      left:   { style: 'thin', color: { rgb: '6366F1' } },
      right:  { style: 'thin', color: { rgb: '6366F1' } },
    },
  },
  cellNormal: {
    font: { sz: 9 },
    alignment: { vertical: 'center' },
    border: {
      bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
      right:  { style: 'hair', color: { rgb: 'E2E8F0' } },
    },
  },
  cellCenter: {
    font: { sz: 9 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
      right:  { style: 'hair', color: { rgb: 'E2E8F0' } },
    },
  },
  cellAlt: {
    font: { sz: 9 },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { vertical: 'center' },
    border: {
      bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
      right:  { style: 'hair', color: { rgb: 'E2E8F0' } },
    },
  },
  titleCell: {
    font: { bold: true, sz: 14, color: { rgb: '1E1B4B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  subtitleCell: {
    font: { sz: 9, color: { rgb: '64748B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  kpiLabel: {
    font: { sz: 8, color: { rgb: '64748B' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
  },
  kpiValue: {
    font: { bold: true, sz: 13, color: { rgb: '4F46E5' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      bottom: { style: 'medium', color: { rgb: '4F46E5' } },
    },
  },
  gold:   { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 }, fill: { fgColor: { rgb: 'D97706' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  silver: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 }, fill: { fgColor: { rgb: '94A3B8' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  bronze: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 }, fill: { fgColor: { rgb: 'B45309' } }, alignment: { horizontal: 'center', vertical: 'center' } },
};

/** Cria uma sheet "Resumo" com KPIs e metadados */
const buildResumoSheet = (statistics, topRecebedores, avgCliByRecebedor, period) => {
  const ws = {};
  const fmt = formatMinutes;
  const total = topRecebedores.reduce((s, r) => s + r.count, 0);
  const avgCLITotal = (() => {
    const vals = Object.values(avgCliByRecebedor);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  // Dimensões
  ws['!cols'] = [
    { wch: 32 }, { wch: 26 }, { wch: 26 }, { wch: 26 },
  ];
  ws['!rows'] = [
    { hpt: 36 }, { hpt: 18 }, { hpt: 8 }, { hpt: 28 }, { hpt: 28 },
    { hpt: 8 }, { hpt: 20 }, { hpt: 26 }, { hpt: 26 }, { hpt: 26 }, { hpt: 26 },
  ];

  // Título
  ws['A1'] = { t: 's', v: 'Dashboard de Indicadores — Resumo', s: STYLE.titleCell };
  ws['A2'] = { t: 's', v: `Período: ${periodLabel(period)}   •   Gerado em: ${new Date().toLocaleString('pt-BR')}`, s: STYLE.subtitleCell };

  // KPI labels (linha 4)
  ['TOTAL DE ENTREGAS', 'MOTORISTAS ATIVOS', 'TOP RECEBEDOR (QTD)', 'TEMPO MÉDIO CLI'].forEach((label, i) => {
    const col = String.fromCharCode(65 + i);
    ws[`${col}4`] = { t: 's', v: label, s: STYLE.kpiLabel };
    ws[`${col}5`] = {
      t: i === 3 ? 's' : 'n',
      v: [
        statistics?.totalDeliveries ?? 0,
        statistics?.deliveriesByDriver?.length ?? 0,
        topRecebedores[0]?.count ?? 0,
        fmt(avgCLITotal),
      ][i],
      s: STYLE.kpiValue,
    };
  });

  // Tabela de recebedores
  ws['A7'] = { t: 's', v: 'RANKING DE RECEBEDORES', s: STYLE.headerDark };
  ws['B7'] = { t: 's', v: 'ENTREGAS', s: STYLE.headerDark };
  ws['C7'] = { t: 's', v: 'TEMPO MÉDIO CLI', s: STYLE.headerDark };
  ws['D7'] = { t: 's', v: '% DO TOTAL', s: STYLE.headerDark };

  topRecebedores.forEach((r, i) => {
    const row = 8 + i;
    const pct = total > 0 ? +((r.count / total) * 100).toFixed(1) : 0;
    const avg = avgCliByRecebedor[r.recebedor];
    const isAlt = i % 2 === 1;
    const cellS = isAlt ? STYLE.cellAlt : STYLE.cellNormal;
    const posStyle = [STYLE.gold, STYLE.silver, STYLE.bronze][i] ?? STYLE.cellCenter;

    ws[`A${row}`] = { t: 's', v: r.recebedor, s: cellS };
    ws[`B${row}`] = { t: 'n', v: r.count, s: { ...STYLE.cellCenter, ...(isAlt ? { fill: STYLE.cellAlt.fill } : {}) } };
    ws[`C${row}`] = { t: 's', v: fmt(avg), s: { ...STYLE.cellCenter, ...(isAlt ? { fill: STYLE.cellAlt.fill } : {}) } };
    ws[`D${row}`] = { t: 'n', v: pct, s: { ...STYLE.cellCenter, ...(isAlt ? { fill: STYLE.cellAlt.fill } : {}) } };
    ws[`D${row}`].z = '0.0"%"';
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 7 + topRecebedores.length, c: 3 } });
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];

  return ws;
};

/** Cria sheet de entregas por dia */
const buildDiariaSheet = (dailyDeliveries) => {
  const rows = [['DATA', 'DIA DA SEMANA', 'QUANTIDADE DE ENTREGAS']];
  (dailyDeliveries ?? []).forEach((d) => {
    const parts = String(d._id).split('-');
    let dateLabel = d._id;
    let weekDay = '';
    if (parts.length === 3) {
      const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      dateLabel = dt.toLocaleDateString('pt-BR');
      weekDay = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
    }
    rows.push([dateLabel, weekDay, d.count]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 26 }];

  styleRange(ws, `A1:C1`, STYLE.headerAccent);
  for (let i = 1; i < rows.length; i++) {
    const s = i % 2 === 0 ? STYLE.cellAlt : STYLE.cellNormal;
    styleRange(ws, `A${i + 1}:C${i + 1}`, s);
    ws[`C${i + 1}`].s = { ...s, alignment: { horizontal: 'center', vertical: 'center' } };
  }
  return ws;
};

/** Cria sheet de entregas por contratado */
const buildContratadoSheet = (deliveriesByDriver, totalDeliveries) => {
  const rows = [['CONTRATADO', 'ENTREGAS', '% DO TOTAL']];
  (deliveriesByDriver ?? []).forEach((d) => {
    const pct = totalDeliveries > 0 ? +((d.count / totalDeliveries) * 100).toFixed(1) : 0;
    rows.push([d._id, d.count, pct]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }];

  styleRange(ws, `A1:C1`, STYLE.headerAccent);
  for (let i = 1; i < rows.length; i++) {
    const s = i % 2 === 0 ? STYLE.cellAlt : STYLE.cellNormal;
    styleRange(ws, `A${i + 1}:C${i + 1}`, s);
    ['B', 'C'].forEach((col) => {
      if (ws[`${col}${i + 1}`]) ws[`${col}${i + 1}`].s = { ...s, alignment: { horizontal: 'center', vertical: 'center' } };
    });
    if (ws[`C${i + 1}`]) ws[`C${i + 1}`].z = '0.0"%"';
  }
  return ws;
};

/** Cria sheet detalhada de recebedores + CLI */
const buildRecebedorSheet = (topRecebedores, avgCliByRecebedor) => {
  const total = topRecebedores.reduce((s, r) => s + r.count, 0);
  const rows = [['POS.', 'RECEBEDOR', 'ENTREGAS', 'TEMPO MÉDIO CLI', '% DO TOTAL', 'CLI (MINUTOS)']];

  topRecebedores.forEach((r, i) => {
    const pct = total > 0 ? +((r.count / total) * 100).toFixed(1) : 0;
    const avgMin = avgCliByRecebedor[r.recebedor];
    rows.push([
      `${i + 1}º`,
      r.recebedor,
      r.count,
      formatMinutes(avgMin),
      pct,
      avgMin != null ? +avgMin.toFixed(1) : '-',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];

  styleRange(ws, `A1:F1`, STYLE.headerDark);
  for (let i = 1; i < rows.length; i++) {
    const s = i % 2 === 0 ? STYLE.cellAlt : STYLE.cellNormal;
    styleRange(ws, `A${i + 1}:F${i + 1}`, s);

    const posStyle = [STYLE.gold, STYLE.silver, STYLE.bronze][i - 1];
    if (posStyle && ws[`A${i + 1}`]) ws[`A${i + 1}`].s = posStyle;

    ['C', 'D', 'E', 'F'].forEach((col) => {
      if (ws[`${col}${i + 1}`]) {
        ws[`${col}${i + 1}`].s = { ...s, alignment: { horizontal: 'center', vertical: 'center' } };
      }
    });
    if (ws[`E${i + 1}`]) ws[`E${i + 1}`].z = '0.0"%"';
  }
  return ws;
};

/**
 * Exporta para Excel com múltiplas abas
 */
export const exportToExcel = (payload) => {
  const {
    statistics,
    topRecebedores,
    avgCliByRecebedor,
    period,
  } = payload;

  // Cria workbook
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title:   'Dashboard de Indicadores',
    Subject: 'Relatório Operacional',
    Author:  'Sistema de Entregas',
    CreatedDate: new Date(),
  };

  // Aba 1 — Resumo
  XLSX.utils.book_append_sheet(
    wb,
    buildResumoSheet(statistics, topRecebedores, avgCliByRecebedor, period),
    'Resumo'
  );

  // Aba 2 — Entregas por Dia
  XLSX.utils.book_append_sheet(
    wb,
    buildDiariaSheet(statistics?.dailyDeliveries),
    'Entregas por Dia'
  );

  // Aba 3 — Por Contratado
  XLSX.utils.book_append_sheet(
    wb,
    buildContratadoSheet(statistics?.deliveriesByDriver, statistics?.totalDeliveries),
    'Por Contratado'
  );

  // Aba 4 — Ranking Recebedores
  XLSX.utils.book_append_sheet(
    wb,
    buildRecebedorSheet(topRecebedores, avgCliByRecebedor),
    'Ranking Recebedores'
  );

  const fileName = `dashboard_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary', cellStyles: true });
  return fileName;
};
