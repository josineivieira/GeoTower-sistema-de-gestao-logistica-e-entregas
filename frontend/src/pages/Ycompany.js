import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaFilter, FaSearch } from 'react-icons/fa';

const Ycompany = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Colunas da tabela
  const columns = [
    'Código',
    'N° GeoMaritima',
    'Dt. início',
    'Situação',
    'Cliente',
    'Remetente',
    'Destinatário',
    'Contratado',
    'Tipo',
    'Dt. SM',
    'Motorista',
    'Tração',
    'Reboque',
    'Origem',
    'UF coleta',
    'Pagamento',
    'TAG Pedágio',
    'Vl. frete processo',
    'Vl. pedágio',
    'Vl. frete lista',
    'Vl. abastecimento',
    'Dt. agendamento descarga',
    'Dt. chegada',
    'Dt.Início Descarga',
    'Hr.Inicio Descarga',
    'Dt. descida CNTR/Carga',
    'Dt. retirada P.D.',
    'Dt. fim descarga',
    'Dt. devolução CNTR',
    'Terminal',
    'Destino',
    'UF entrega',
    'Estab. CT-e/NFS-e',
    'N° CT-e/NFS-e',
    'N° averbação CTE',
    'N° CIOT',
    'Situação CIOT',
    'N° MDFE',
    'Situação MDFE',
    'Dt. averbação MDFE',
    'N° boooking',
    'N° boooking agendamento',
    'Armador',
    'Navio',
    'Tipo',
    'Número',
    'Tara',
    'Lacre',
    'Payload',
    'Temperatura (C°)',
    'Umidade (%)',
    'Ventilação (Cbm)',
    'Peso bruto',
    'Motorista pulmão',
    'Motorista retro',
    'Estab.',
  ];

  useEffect(() => {
    // Inicializa com dados vazios (integrar com API depois)
    setData([]);
    setLoading(false);
  }, []);

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  const handleExport = () => {
    // Implementar exportação para Excel/CSV
    console.log('Exportar dados...');
  };

  const filteredData = data.filter((row) =>
    columns.some((col) => String(row[col] || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3FA' }}>
      {/* Header */}
      <div
        className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-8 px-6"
        style={{
          boxShadow: '0 4px 20px rgba(108,79,248,.3)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <FaArrowLeft className="text-xl" />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Ycompany</h1>
              <p className="text-sm text-white/70 mt-1">Base de dados operacional marítima</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
          >
            <FaDownload />
            Exportar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por qualquer campo..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <FaFilter /> Filtros
            </button>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Carregando dados...</p>
          </div>
        ) : filteredData.length === 0 && data.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-600 mb-2">Nenhum dado disponível</p>
            <p className="text-sm text-gray-400">Começar a adicionar registros operacionais</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left font-bold text-gray-700 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      {columns.map((col) => (
                        <td
                          key={`${idx}-${col}`}
                          className="px-4 py-3 text-gray-600 whitespace-nowrap"
                        >
                          {row[col] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer da tabela */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Total de {filteredData.length} registros
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Ycompany;
