import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { FaArrowLeft, FaUpload, FaCheck, FaTimes, FaSync } from 'react-icons/fa';

const Reconciliation = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedUpdates, setSelectedUpdates] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) {
      setToast({ message: 'Selecione um arquivo', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await adminService.uploadReconciliation(file);
      setResults(response.data?.results || {});
      setToast({ message: 'Arquivo processado com sucesso', type: 'success' });
      setFile(null);
    } catch (error) {
      setToast({ 
        message: error.response?.data?.message || 'Erro ao processar arquivo', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdates = async () => {
    if (selectedUpdates.length === 0) {
      setToast({ message: 'Nenhuma entrega selecionada', type: 'error' });
      return;
    }

    const updates = (results?.statusDiff || [])
      .filter(item => selectedUpdates.includes(item.deliveryNumber))
      .map(item => ({
        deliveryNumber: item.deliveryNumber,
        newStatus: item.normalizedStatus
      }));

    setLoading(true);
    try {
      await adminService.applyReconciliation(updates);
      setToast({ message: `${updates.length} entregas atualizadas`, type: 'success' });
      setResults(null);
      setSelectedUpdates([]);
    } catch (error) {
      setToast({ 
        message: error.response?.data?.message || 'Erro ao aplicar atualizações', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUpdate = (deliveryNumber) => {
    setSelectedUpdates(prev => 
      prev.includes(deliveryNumber)
        ? prev.filter(d => d !== deliveryNumber)
        : [...prev, deliveryNumber]
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6"
        >
          <FaArrowLeft /> Voltar
        </button>

        <h1 className="text-3xl font-bold text-gray-800 mb-8">📊 Reconciliação de Dados</h1>

        {!results ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Upload de Planilha</h2>
            <p className="text-gray-600 text-sm mb-4">
              Faça upload de um arquivo CSV/XLSX com colunas: <strong>Número</strong> e <strong>Status</strong>
            </p>
            <div className="flex gap-4">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileChange}
                disabled={loading}
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <FaUpload /> {loading ? 'Processando...' : 'Enviar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                <p className="text-gray-600 text-sm font-semibold">OK</p>
                <p className="text-3xl font-bold text-green-600">{results.found?.length || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <p className="text-gray-600 text-sm font-semibold">Diferente</p>
                <p className="text-3xl font-bold text-blue-600">{results.statusDiff?.length || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
                <p className="text-gray-600 text-sm font-semibold">Não Encontrada</p>
                <p className="text-3xl font-bold text-red-600">{results.notFound?.length || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                <p className="text-gray-600 text-sm font-semibold">Selecionadas</p>
                <p className="text-3xl font-bold text-purple-600">{selectedUpdates.length}</p>
              </div>
            </div>

            {(results.statusDiff?.length || 0) > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Entregas com Status Diferente</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedUpdates.length === (results.statusDiff?.length || 0)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUpdates((results.statusDiff || []).map(d => d.deliveryNumber));
                              } else {
                                setSelectedUpdates([]);
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-left">Número</th>
                        <th className="px-4 py-3 text-left">Contratado</th>
                        <th className="px-4 py-3 text-left">Sistema</th>
                        <th className="px-4 py-3 text-left">Planilha</th>
                        <th className="px-4 py-3 text-left">Novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(results.statusDiff || []).map((item) => (
                        <tr key={item.deliveryNumber} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedUpdates.includes(item.deliveryNumber)}
                              onChange={() => toggleUpdate(item.deliveryNumber)}
                            />
                          </td>
                          <td className="px-4 py-3">{item.deliveryNumber}</td>
                          <td className="px-4 py-3">{item.userName}</td>
                          <td className="px-4 py-3"><span className="bg-yellow-100 px-2 py-1 rounded text-xs">{item.systemStatus}</span></td>
                          <td className="px-4 py-3"><span className="bg-blue-100 px-2 py-1 rounded text-xs">{item.uploadedStatus}</span></td>
                          <td className="px-4 py-3"><span className="bg-green-100 px-2 py-1 rounded text-xs">{item.normalizedStatus}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex gap-4">
                  <button
                    onClick={handleApplyUpdates}
                    disabled={selectedUpdates.length === 0 || loading}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <FaCheck /> Aplicar ({selectedUpdates.length})
                  </button>
                  <button
                    onClick={() => { setResults(null); setSelectedUpdates([]); }}
                    className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {(results.notFound?.length || 0) > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Não Encontradas ({results.notFound.length})</h3>
                <div className="space-y-2">
                  {results.notFound.map((item) => (
                    <div key={item.deliveryNumber} className="p-3 bg-red-50 border border-red-200 rounded">
                      <p className="font-semibold">{item.deliveryNumber}</p>
                      <p className="text-xs text-gray-600">{item.uploadedStatus}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(results.found?.length || 0) > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Sem Mudanças ({results.found.length})</h3>
                <div className="space-y-2">
                  {results.found.map((item) => (
                    <div key={item.deliveryNumber} className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="font-semibold">{item.deliveryNumber}</p>
                      <p className="text-xs text-gray-600">{item.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default Reconciliation;
