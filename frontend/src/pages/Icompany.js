import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaDownload,
  FaSearch,
  FaSyncAlt,
  FaTimes,
} from 'react-icons/fa';
import { MdTableChart } from 'react-icons/md';
import api from '../services/api';

const NEW_BASE_COLUMNS = [
  { label: 'Código do processo', field: 'codigo', sticky: true },
  { label: 'Nr. do processo', field: 'nrProcesso', sticky: true },
  { label: 'Estab.', field: 'estab' },
  { label: 'Sentido', field: 'sentido' },
  { label: 'Dt. criado', field: 'dtInicio', type: 'date' },
  { label: 'Situação', field: 'situacao', type: 'status' },
  { label: 'Dt. coleta', field: 'dtColeta', type: 'date' },
  { label: 'Dt. chegada planta', field: 'dtChegadaPlanta', type: 'date' },
  { label: 'Dt. retirada CNTR vazio', field: 'dtRetiradaCNTRVazio', type: 'date' },
  { label: 'Dt. início carregamento', field: 'dtInicioCarregamento', type: 'date' },
  { label: 'Dt. fim carregamento', field: 'dtFimCarregamento', type: 'date' },
  { label: 'Dt. saída planta', field: 'dtSaidaPlanta', type: 'date' },
  { label: 'Dt. fim agendamento', field: 'dtFimAgendamento', type: 'date' },
  { label: 'Dt. retirada P.D.', field: 'dtRetiraPD', type: 'date' },
  { label: 'Dt. inicio descarga', field: 'dtInicioDescarga', type: 'date' },
  { label: 'Dt. agendamento descarga', field: 'dtAgendamentoDescarga', type: 'date' },
  { label: 'Dt. fim descarga', field: 'dtFimDescarga', type: 'date' },
  { label: 'Dt. devolução CNTR', field: 'dtDevolucaoCNTR', type: 'date' },
  { label: 'Observação', field: 'observacao', wide: true },
  { label: 'Cliente', field: 'cliente', wide: true },
  { label: 'Remetente', field: 'remetente', wide: true },
  { label: 'Destinatário', field: 'destinatario', wide: true },
  { label: 'Contratado', field: 'contratado', wide: true },
  { label: 'Motorista', field: 'motorista', wide: true },
  { label: 'Tipo frota', field: 'tipo' },
  { label: 'Cód. processo integração', field: 'codProcessoIntegracao' },
  { label: 'Nº Container', field: 'containerNumero' },
  { label: 'Placa tracao', field: 'tracao' },
  { label: 'RIC DE ABASTECIMENTO', field: 'ricAbastecimento', type: 'number' },
  { label: 'RIC PORTO DESTINO', field: 'ricPortoDestino', type: 'number' },
  { label: 'COMPROVANTE DE DESOVA', field: 'comprovanteDesova', type: 'number' },
  { label: 'RIC DEPOT', field: 'ricDepot', type: 'number' },
  { label: 'DIARIO DE BORDO', field: 'diarioBordo', type: 'number' },
  { label: 'SOLICITAÇÃO DE MONITORAMENTO', field: 'solicitacaoMonitoramento', type: 'number' },
  { label: 'RIC PORTO', field: 'ricPorto', type: 'number' },
  { label: 'DISCO/ARQUIVO TACOGRAFO', field: 'discoTacografo', type: 'number' },
  { label: 'CANHOTO DE DANFE', field: 'canhotoDanfe', type: 'number' },
  { label: 'VALE PALLET', field: 'valePallet', type: 'number' },
  { label: 'NOSHOW', field: 'noshow', type: 'number' },
  { label: 'RIC DEPOT DESTINO', field: 'ricDepotDestino', type: 'number' },
  { label: 'FOTOS', field: 'fotos', type: 'number' },
  { label: 'RIC RETROAREA', field: 'ricRetroarea', type: 'number' },
];

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatValue = (value, column) => {
  if (value === null || value === undefined || value === '') return '—';
  if (column.type === 'date') return formatDate(value) || '—';
  if (column.type === 'number') return Number(value || 0).toLocaleString('pt-BR');
  return String(value);
};

const statusClass = (value) => {
  const text = String(value || '').toUpperCase();
  if (text.includes('CONCLU')) return 'done';
  if (text.includes('CANCEL')) return 'cancel';
  if (text.includes('CONFIRM')) return 'confirmed';
  if (text.includes('ANDAMENTO') || text.includes('EXEC')) return 'running';
  return 'default';
};

const Icompany = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/icompany');
      setData(response.data?.data || []);
    } catch (err) {
      setData([]);
      setError('Falha ao carregar a base Icompany.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data;

    return data.filter((row) =>
      NEW_BASE_COLUMNS.some((column) => {
        const value = row[column.field];
        return value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    return data.reduce(
      (acc, row) => {
        if (row.estab === 'LAM') acc.lam += 1;
        if (row.estab === 'LSC') acc.lsc += 1;
        return acc;
      },
      { lam: 0, lsc: 0 }
    );
  }, [data]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleExport = () => {
    const escapeCsv = (value) => {
      const text = value === null || value === undefined ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = [
      NEW_BASE_COLUMNS.map((column) => escapeCsv(column.label)).join(';'),
      ...filteredData.map((row) =>
        NEW_BASE_COLUMNS
          .map((column) => escapeCsv(column.type === 'date' ? formatDate(row[column.field]) : row[column.field]))
          .join(';')
      ),
    ];

    const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `icompany-nova-base-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        .ic-root {
          min-height: 100vh;
          background: #f4f6fb;
          color: #111827;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ic-header {
          position: sticky;
          top: 0;
          z-index: 30;
          background: #0f172a;
          color: #fff;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .ic-header-inner {
          max-width: 1800px;
          margin: 0 auto;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .ic-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .ic-back {
          width: 38px;
          height: 38px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.08);
          color: #fff;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .ic-title-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2563eb;
          flex: 0 0 auto;
        }

        .ic-title {
          font-size: 1.1rem;
          font-weight: 800;
          line-height: 1.1;
        }

        .ic-subtitle {
          margin-top: 3px;
          color: #cbd5e1;
          font-size: .78rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ic-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .ic-btn {
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,.14);
          padding: 0 12px;
          color: #fff;
          background: rgba(255,255,255,.08);
          cursor: pointer;
          font-weight: 700;
          font-size: .8rem;
        }

        .ic-btn.primary {
          border-color: #1d4ed8;
          background: #2563eb;
        }

        .ic-spin { animation: ic-spin .7s linear infinite; }
        @keyframes ic-spin { to { transform: rotate(360deg); } }

        .ic-body {
          max-width: 1800px;
          margin: 0 auto;
          padding: 20px 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ic-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .ic-stat {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 14px;
          box-shadow: 0 1px 3px rgba(15,23,42,.06);
        }

        .ic-stat-label {
          color: #64748b;
          font-size: .72rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .ic-stat-value {
          margin-top: 5px;
          color: #0f172a;
          font-size: 1.25rem;
          font-weight: 850;
        }

        .ic-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px;
          box-shadow: 0 1px 3px rgba(15,23,42,.06);
        }

        .ic-search-wrap {
          position: relative;
          flex: 1;
          min-width: 220px;
        }

        .ic-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .ic-search {
          width: 100%;
          height: 40px;
          border: 1px solid #dbe2ea;
          border-radius: 8px;
          outline: none;
          padding: 0 40px 0 36px;
          color: #0f172a;
          background: #f8fafc;
          font-size: .9rem;
        }

        .ic-search:focus {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37,99,235,.10);
        }

        .ic-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 6px;
        }

        .ic-clear:hover {
          background: #f1f5f9;
          color: #ef4444;
        }

        .ic-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 8px;
          padding: 11px 14px;
          font-size: .86rem;
          font-weight: 650;
        }

        .ic-table-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15,23,42,.06);
        }

        .ic-table-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
        }

        .ic-table-title {
          font-size: .93rem;
          font-weight: 850;
          color: #0f172a;
        }

        .ic-table-subtitle {
          margin-top: 2px;
          font-size: .76rem;
          color: #64748b;
        }

        .ic-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 5px 10px;
          font-size: .74rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .ic-table-wrap {
          overflow: auto;
          max-height: calc(100vh - 310px);
        }

        .ic-table {
          border-collapse: separate;
          border-spacing: 0;
          width: max-content;
          min-width: 100%;
          font-size: .82rem;
        }

        .ic-table th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #f8fafc;
          color: #475569;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #dbe2ea;
          border-right: 1px solid #edf2f7;
          font-size: .7rem;
          text-transform: uppercase;
          letter-spacing: .03em;
          white-space: nowrap;
        }

        .ic-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #eef2f7;
          border-right: 1px solid #f3f6fa;
          color: #334155;
          background: #fff;
          max-width: 280px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ic-table tr:nth-child(even) td {
          background: #fcfdff;
        }

        .ic-table tr:hover td {
          background: #f8fbff;
        }

        .ic-table .sticky-0 {
          position: sticky;
          left: 0;
          z-index: 4;
          min-width: 134px;
          max-width: 134px;
          color: #1d4ed8;
          font-weight: 850;
          border-right: 1px solid #dbeafe;
        }

        .ic-table .sticky-1 {
          position: sticky;
          left: 134px;
          z-index: 4;
          min-width: 128px;
          max-width: 128px;
          font-weight: 750;
          border-right: 1px solid #dbeafe;
        }

        .ic-table th.sticky-0,
        .ic-table th.sticky-1 {
          z-index: 8;
          background: #eff6ff;
        }

        .ic-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 9px;
          font-size: .73rem;
          font-weight: 800;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ic-status.done { color: #047857; background: #ecfdf5; }
        .ic-status.cancel { color: #b91c1c; background: #fef2f2; }
        .ic-status.confirmed { color: #1d4ed8; background: #eff6ff; }
        .ic-status.running { color: #a16207; background: #fefce8; }
        .ic-status.default { color: #475569; background: #f1f5f9; }

        .ic-empty {
          padding: 52px 20px;
          text-align: center;
          color: #64748b;
        }

        .ic-empty strong {
          display: block;
          color: #0f172a;
          margin-bottom: 5px;
        }

        .ic-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          border-top: 1px solid #e5e7eb;
          color: #64748b;
          background: #f8fafc;
          font-size: .78rem;
        }

        @media (max-width: 900px) {
          .ic-header-inner,
          .ic-body { padding-left: 14px; padding-right: 14px; }
          .ic-header-inner { align-items: flex-start; flex-direction: column; }
          .ic-actions { justify-content: flex-start; }
          .ic-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ic-toolbar { flex-direction: column; align-items: stretch; }
          .ic-table-wrap { max-height: calc(100vh - 390px); }
        }
      `}</style>

      <div className="ic-root">
        <header className="ic-header">
          <div className="ic-header-inner">
            <div className="ic-title-row">
              <button className="ic-back" onClick={() => navigate('/home')} title="Voltar">
                <FaArrowLeft />
              </button>
              <div className="ic-title-icon">
                <MdTableChart />
              </div>
              <div>
                <div className="ic-title">Icompany</div>
              </div>
            </div>

            <div className="ic-actions">
              <button className="ic-btn" onClick={handleRefresh}>
                <FaSyncAlt className={refreshing ? 'ic-spin' : ''} />
                Atualizar
              </button>
              <button className="ic-btn primary" onClick={handleExport} disabled={!filteredData.length}>
                <FaDownload />
                Exportar CSV
              </button>
            </div>
          </div>
        </header>

        <main className="ic-body">
          {error && (
            <div className="ic-error">
              <span>{error}</span>
              <button className="ic-btn primary" onClick={fetchData}>Tentar novamente</button>
            </div>
          )}

          <section className="ic-stats">
            <div className="ic-stat">
              <div className="ic-stat-label">Total</div>
              <div className="ic-stat-value">{loading ? '—' : data.length.toLocaleString('pt-BR')}</div>
            </div>
            <div className="ic-stat">
              <div className="ic-stat-label">Manaus LAM</div>
              <div className="ic-stat-value">{loading ? '—' : stats.lam.toLocaleString('pt-BR')}</div>
            </div>
            <div className="ic-stat">
              <div className="ic-stat-label">Itajaí LSC</div>
              <div className="ic-stat-value">{loading ? '—' : stats.lsc.toLocaleString('pt-BR')}</div>
            </div>
            <div className="ic-stat">
              <div className="ic-stat-label">Colunas</div>
              <div className="ic-stat-value">{NEW_BASE_COLUMNS.length}</div>
            </div>
          </section>

          <section className="ic-toolbar">
            <div className="ic-search-wrap">
              <FaSearch className="ic-search-icon" />
              <input
                className="ic-search"
                type="text"
                placeholder="Buscar na base por processo, container, cliente, motorista..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <button className="ic-clear" onClick={() => setSearchTerm('')} title="Limpar busca">
                  <FaTimes />
                </button>
              )}
            </div>
          </section>

          <section className="ic-table-card">
            <div className="ic-table-head">
              <div>
                <div className="ic-table-title">Registros da Nova Base</div>
                <div className="ic-table-subtitle">Somente campos presentes na planilha `ic_uldConsulta_PX90016.xls`</div>
              </div>
              <span className="ic-pill">
                {loading ? 'Carregando...' : `${filteredData.length.toLocaleString('pt-BR')} registros`}
              </span>
            </div>

            {loading ? (
              <div className="ic-empty">
                <strong>Carregando base...</strong>
                Aguarde enquanto os registros são consultados.
              </div>
            ) : filteredData.length === 0 ? (
              <div className="ic-empty">
                <strong>Nenhum registro encontrado</strong>
                {searchTerm ? 'Tente outro termo de busca.' : 'A base não retornou registros.'}
              </div>
            ) : (
              <div className="ic-table-wrap">
                <table className="ic-table">
                  <thead>
                    <tr>
                      {NEW_BASE_COLUMNS.map((column, index) => (
                        <th
                          key={column.field}
                          className={index === 0 ? 'sticky-0' : index === 1 ? 'sticky-1' : ''}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, rowIndex) => (
                      <tr key={row._id || `${row.codigo}-${rowIndex}`}>
                        {NEW_BASE_COLUMNS.map((column, columnIndex) => {
                          const value = row[column.field];
                          const display = formatValue(value, column);
                          return (
                            <td
                              key={`${rowIndex}-${column.field}`}
                              className={columnIndex === 0 ? 'sticky-0' : columnIndex === 1 ? 'sticky-1' : ''}
                              title={display !== '—' ? display : undefined}
                              style={column.wide ? { minWidth: 240 } : undefined}
                            >
                              {column.type === 'status' && display !== '—' ? (
                                <span className={`ic-status ${statusClass(display)}`}>{display}</span>
                              ) : (
                                display
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ic-footer">
              <span>Exibindo {filteredData.length.toLocaleString('pt-BR')} de {data.length.toLocaleString('pt-BR')} registros</span>
              <span>LAM = Manaus | LSC = Itajaí</span>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default Icompany;
