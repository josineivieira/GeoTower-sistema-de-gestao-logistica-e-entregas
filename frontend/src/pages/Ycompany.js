import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaFilter, FaSearch } from 'react-icons/fa';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';

const Ycompany = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mapeamento entre nomes de display e campos de banco de dados
  const fieldMapping = {
    'Código': 'codigo',
    'N° GeoMaritima': 'geomaritima',
    'Dt. início': 'dtInicio',
    'Situação': 'situacao',
    'Cliente': 'cliente',
    'Remetente': 'remetente',
    'Destinatário': 'destinatario',
    'Contratado': 'contratado',
    'Tipo': 'tipo',
    'Dt. SM': 'dtSM',
    'Motorista': 'motorista',
    'Tração': 'tracao',
    'Reboque': 'reboque',
    'Origem': 'origem',
    'UF coleta': 'ufColeta',
    'Pagamento': 'pagamento',
    'TAG Pedágio': 'tagPedagio',
    'Vl. frete processo': 'vlFreteProcesso',
    'Vl. pedágio': 'vlPedagio',
    'Vl. frete lista': 'vlFreteLista',
    'Vl. abastecimento': 'vlAbastecimento',
    'Dt. agendamento descarga': 'dtAgendamentoDescarga',
    'Dt. chegada': 'dtChegada',
    'Dt.Início Descarga': 'dtInicioDescarga',
    'Hr.Inicio Descarga': 'hrInicioDescarga',
    'Dt. descida CNTR/Carga': 'dtDescidaCNTRCarga',
    'Dt. retirada P.D.': 'dtRetiraPD',
    'Dt. fim descarga': 'dtFimDescarga',
    'Dt. devolução CNTR': 'dtDevolucaoCNTR',
    'Terminal': 'terminal',
    'Destino': 'destino',
    'UF entrega': 'ufEntrega',
    'Estab. CT-e/NFS-e': 'estabCTeNFSe',
    'N° CT-e/NFS-e': 'numCTeNFSe',
    'N° averbação CTE': 'numAverbacaoCTE',
    'N° CIOT': 'numCIOT',
    'Situação CIOT': 'situacaoCIOT',
    'N° MDFE': 'numMDFE',
    'Situação MDFE': 'situacaoMDFE',
    'Dt. averbação MDFE': 'dtAverbacaoMDFE',
    'N° boooking': 'numBooking',
    'N° boooking agendamento': 'numBookingAgendamento',
    'Armador': 'armador',
    'Navio': 'navio',
    'Número': 'numero',
    'Tara': 'tara',
    'Lacre': 'lacre',
    'Payload': 'payload',
    'Temperatura (C°)': 'temperatura',
    'Umidade (%)': 'umidade',
    'Ventilação (Cbm)': 'ventilacao',
    'Peso bruto': 'pesoBruto',
    'Motorista pulmão': 'motoristaPulmao',
    'Motorista retro': 'motoristaRetro',
    'Estab.': 'estab',
  };

  // Colunas da tabela
  const columns = Object.keys(fieldMapping);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/ycompany`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-City': localStorage.getItem('userCity') || 'default',
          },
        });
        
        if (!response.ok) {
          throw new Error('Falha ao carregar dados');
        }
        
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Falha ao carregar dados da Ycompany');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = async (value) => {
    setSearchTerm(value);
    
    if (!value.trim()) {
      // Se vazio, recarrega todos os dados
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/ycompany`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-City': localStorage.getItem('userCity') || 'default',
          },
        });
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        console.error('Erro ao recarregar dados:', err);
      }
      return;
    }

    // Busca com termo
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/ycompany/search?q=${encodeURIComponent(value)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-City': localStorage.getItem('userCity') || 'default',
        },
      });
      
      if (!response.ok) {
        throw new Error('Falha na busca');
      }
      
      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      console.error('Erro na busca:', err);
      setError('Falha ao buscar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/ycompany/export`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-City': localStorage.getItem('userCity') || 'default',
        },
      });
      
      if (!response.ok) {
        throw new Error('Falha ao exportar');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ycompany-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao exportar:', err);
      alert('Falha ao exportar dados');
    }
  };

  const filteredData = data;

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

        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

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
                          {row[fieldMapping[col]] || '—'}
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
