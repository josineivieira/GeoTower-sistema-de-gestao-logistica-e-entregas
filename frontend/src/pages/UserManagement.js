import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useAuth } from '../services/authContext';
import { FaArrowLeft, FaEdit, FaTrash, FaPlus, FaUser } from 'react-icons/fa';

const UserManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'driver'
  });

  useEffect(() => {
    // Proteger rota - gerentes, admins e GeoMar podem acessar (GeoMar apenas visualização)
    if (!user || (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'geomar')) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [user, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      // Chamamos a API de admin para listar usuários
      const response = await adminService.getUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      setToast({ message: 'Erro ao carregar usuários', type: 'error' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.name) {
      setToast({ message: 'Preencha todos os campos', type: 'error' });
      return;
    }

    try {
      if (editingUser) {
        // Atualizar usuário
        await adminService.updateUser(editingUser._id, formData);
        setToast({ message: 'Usuário atualizado com sucesso', type: 'success' });
      } else {
        // Criar novo usuário
        if (!formData.password) {
          setToast({ message: 'Senha é obrigatória para novo usuário', type: 'error' });
          return;
        }
        await adminService.createUser(formData);
        setToast({ message: 'Usuário criado com sucesso', type: 'success' });
      }

      setFormData({ username: '', email: '', name: '', password: '', role: 'driver' });
      setEditingUser(null);
      setShowForm(false);
      loadUsers();
    } catch (error) {
      setToast({ message: error.response?.data?.message || 'Erro ao salvar usuário', type: 'error' });
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name,
      password: '',
      role: user.role
    });
    setShowForm(true);
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Tem certeza que deseja deletar este usuário?')) {
      try {
        await adminService.deleteUser(userId);
        setToast({ message: 'Usuário deletado com sucesso', type: 'success' });
        loadUsers();
      } catch (error) {
        setToast({ message: 'Erro ao deletar usuário', type: 'error' });
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({ username: '', email: '', name: '', password: '', role: 'driver' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
          <div className="px-6 py-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-purple-700 transition duration-200"
              >
                <FaArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FaUser /> Gerenciamento de Usuários
              </h1>
            </div>
            {(user.role === 'manager' || user.role === 'admin') && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                <FaPlus /> Novo Usuário
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Formulário */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  {editingUser ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nome de Usuário
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        disabled={editingUser}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Perfil
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition bg-white"
                      >
                        <option value="driver">🚗 Motorista</option>
                        <option value="manager">📋 Gerente</option>
                        <option value="admin">👑 Admin</option>
                        <option value="geomar">🌎 GeoMar</option>
                      </select>
                    </div>

                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Senha
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-semibold shadow-md hover:shadow-lg"
                    >
                      {editingUser ? '💾 Atualizar' : '✅ Criar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tabela de Usuários */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            {loading ? (
              <div className="p-16 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600 mx-auto mb-4" />
                <p className="text-gray-600">Carregando usuários...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-16 text-center">
                <FaUser className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                        Usuário
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                        Nome Completo
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                        Perfil
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-gray-800">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <tr key={user._id} className={`border-b border-gray-100 transition duration-150 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-purple-50`}>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {user.username}
                        </td>
                        <td className="px-6 py-4 text-gray-700">{user.email}</td>
                        <td className="px-6 py-4 text-gray-700 font-medium">{user.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 w-fit ${
                            user.role === 'admin'
                              ? 'bg-red-100 text-red-700'
                              : user.role === 'manager'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'geomar'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role === 'admin' ? '👑' : user.role === 'manager' ? '📋' : user.role === 'geomar' ? '🌎' : '🚗'}
                            {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Gerente' : user.role === 'geomar' ? 'GeoMar' : 'Motorista'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(() => {
                            // Admin: pode editar qualquer um
                            if (user.role === 'admin') {
                              return (
                                <>
                                  <button
                                    onClick={() => handleEdit(user)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-200 font-semibold mr-2 shadow-sm hover:shadow-md"
                                  >
                                    <FaEdit size={14} /> Editar
                                  </button>
                                  <button
                                    onClick={() => handleDelete(user._id)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition duration-200 font-semibold shadow-sm hover:shadow-md"
                                  >
                                    <FaTrash size={14} /> Deletar
                                  </button>
                                </>
                              );
                            }
                            // Manager: pode editar qualquer um EXCETO admin
                            if (user.role !== 'admin') {
                              return (
                                <>
                                  <button
                                    onClick={() => handleEdit(user)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-200 font-semibold mr-2 shadow-sm hover:shadow-md"
                                  >
                                    <FaEdit size={14} /> Editar
                                  </button>
                                  <button
                                    onClick={() => handleDelete(user._id)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition duration-200 font-semibold shadow-sm hover:shadow-md"
                                  >
                                    <FaTrash size={14} /> Deletar
                                  </button>
                                </>
                              );
                            }
                            // GeoMar: sem botões
                            return null;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Estatísticas Rodapé */}
          {!loading && users.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-600">
                <p className="text-gray-600 text-sm font-semibold">Total de Usuários</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{users.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600">
                <p className="text-gray-600 text-sm font-semibold">Motoristas</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{users.filter(u => u.role === 'driver').length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-pink-600">
                <p className="text-gray-600 text-sm font-semibold">Admins e Gerentes</p>
                <p className="text-3xl font-bold text-pink-600 mt-2">{users.filter(u => u.role !== 'driver').length}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default UserManagement;
