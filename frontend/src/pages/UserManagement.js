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
    // Proteger rota - só gerentes e admins podem acessar
    if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
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
    <div>
      <div className="max-w-6xl mx-auto p-4 pb-20">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6 transition"
        >
          <FaArrowLeft />
          Voltar
        </button>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">👥 Gerenciamento de Usuários</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FaPlus /> Novo Usuário
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Perfil
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="driver">Motorista</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Admin</option>
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  {editingUser ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabela de Usuários */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Nenhum usuário encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Usuário
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Perfil
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{user.email}</td>
                      <td className="px-4 py-3 text-gray-700">{user.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 w-fit ${
                          user.role === 'admin'
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'manager'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'admin' ? '👑' : user.role === 'manager' ? '📋' : '🚗'}
                          {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Gerente' : 'Motorista'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleEdit(user)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition mr-2"
                        >
                          <FaEdit /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(user._id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                        >
                          <FaTrash /> Deletar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
