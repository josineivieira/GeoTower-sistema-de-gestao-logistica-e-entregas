import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { adminService } from '../services/authService';
import { useAuth } from '../services/authContext';
import {
  FaArrowLeft,
  FaEdit,
  FaTrash,
  FaPlus,
  FaUsers,
  FaCar,
  FaUserShield,
  FaUserTie,
  FaGlobe,
  FaSave,
  FaTimes,
  FaUserPlus,
  FaSearch,
} from 'react-icons/fa';

/* ─── helpers ─────────────────────────────────────────────────────────── */

const ROLE_CONFIG = {
  admin:               { label: 'Admin',               color: 'red',    Icon: FaUserShield },
  manager:             { label: 'Gerente',             color: 'violet', Icon: FaUserTie    },
  geomar:              { label: 'GeoMar',              color: 'teal',   Icon: FaGlobe      },
  gestor_contratado:   { label: 'Gestor Contratado',   color: 'amber',  Icon: FaUserShield },
  driver:              { label: 'Motorista',           color: 'blue',   Icon: FaCar        },
};

const BADGE_CLASSES = {
  red:    'bg-red-50    text-red-700    ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  teal:   'bg-teal-50   text-teal-700   ring-teal-200',
  amber:  'bg-amber-50  text-amber-700  ring-amber-200',
  blue:   'bg-blue-50   text-blue-700   ring-blue-200',
};

const RoleBadge = ({ role }) => {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.driver;
  const { Icon, label, color } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${BADGE_CLASSES[color]}`}
    >
      <Icon size={11} />
      {label}
    </span>
  );
};

/* ─── component ───────────────────────────────────────────────────────── */

const UserManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [users,         setUsers]         = useState([]);
  const [contractors,   setContractors]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editingUser,   setEditingUser]   = useState(null);
  const [search,        setSearch]        = useState('');
  const [formData,      setFormData]      = useState({
    username: '', email: '', name: '', password: '', role: 'driver', contratado: null, city: 'manaus',
  });

  /* ── guard & load ── */
  useEffect(() => {
    if (!user || !['manager', 'admin', 'geomar', 'gestor_contratado'].includes(user.role)) {
      navigate('/');
      return;
    }
    loadUsers();
    loadContractors();
  }, [user, navigate]);

  const loadContractors = async () => {
    try {
      const response = await adminService.getContractors();
      setContractors(response.data.contractors || []);
      console.log('Contractors loaded:', response.data.contractors);
    } catch (err) {
      console.error('Erro ao carregar contratados:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminService.getUsers();
      setUsers(response.data.users || []);
    } catch {
      setToast({ message: 'Erro ao carregar usuários', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /* ── form handlers ── */
  const resetForm = () => {
    setFormData({ username: '', email: '', name: '', password: '', role: 'driver', contratado: null, city: 'manaus' });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.name) {
      setToast({ message: 'Preencha todos os campos obrigatórios', type: 'error' });
      return;
    }
    if (formData.role === 'gestor_contratado' && !formData.contratado) {
      setToast({ message: 'Selecione um contratado para o Gestor Contratado', type: 'error' });
      return;
    }
    try {
      if (editingUser) {
        await adminService.updateUser(editingUser._id, formData);
        setToast({ message: 'Usuário atualizado com sucesso', type: 'success' });
      } else {
        if (!formData.password) {
          setToast({ message: 'Senha é obrigatória para novo usuário', type: 'error' });
          return;
        }
        await adminService.createUser(formData);
        setToast({ message: 'Usuário criado com sucesso', type: 'success' });
      }
      resetForm();
      loadUsers();
    } catch (error) {
      setToast({ message: error.response?.data?.message || 'Erro ao salvar usuário', type: 'error' });
    }
  };

  const handleEdit = (u) => {
    setEditingUser(u);
    setFormData({ username: u.username, email: u.email, name: u.name, password: '', role: u.role, contratado: u.contratado || null, city: u.city || 'manaus' });
    setShowForm(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Confirma a exclusão deste usuário? Esta ação não poderá ser desfeita.')) return;
    try {
      await adminService.deleteUser(userId);
      setToast({ message: 'Usuário excluído com sucesso', type: 'success' });
      loadUsers();
    } catch {
      setToast({ message: 'Erro ao excluir usuário', type: 'error' });
    }
  };

  const canEdit   = (loggedUser) => loggedUser.role === 'admin' || loggedUser.role === 'manager';
  const isAdmin   = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  /* ── filtered list ── */
  const filtered = users.filter((u) =>
    [u.username, u.email, u.name].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  /* ─────────────────────────────── RENDER ──────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* left */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Voltar"
            >
              <FaArrowLeft size={14} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600 text-white shadow">
                <FaUsers size={18} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">
                  Gerenciamento de Usuários
                </h1>
                <p className="text-xs text-slate-500">
                  Administração de contas e permissões
                </p>
              </div>
            </div>
          </div>

          {/* right */}
          {(isAdmin || isManager) && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition"
            >
              <FaUserPlus size={14} />
              Novo Usuário
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats Row */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total',      value: users.length,                              color: 'violet', Icon: FaUsers      },
              { label: 'Motoristas', value: users.filter(u => u.role === 'driver').length,   color: 'blue',   Icon: FaCar        },
              { label: 'Gerentes',   value: users.filter(u => u.role === 'manager').length,  color: 'amber',  Icon: FaUserTie    },
              { label: 'Admins',     value: users.filter(u => u.role === 'admin').length,    color: 'red',    Icon: FaUserShield },
            ].map(({ label, value, color, Icon }) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4"
              >
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl bg-${color}-50 text-${color}-600`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* toolbar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-semibold text-slate-700">
              {loading ? 'Carregando...' : `${filtered.length} usuário${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
            </p>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent w-64 bg-slate-50"
              />
            </div>
          </div>

          {/* table body */}
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-4 text-slate-400">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-sm">Carregando usuários...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                <FaUsers size={24} />
              </div>
              <p className="text-sm font-medium">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Usuário', 'Nome Completo', 'E-mail', 'Perfil', 'Ações'].map((col) => (
                      <th
                        key={col}
                        className={`px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                          col === 'Ações' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-50">
                  {filtered.map((u) => {
                    // managers should be able to touch any account, including
                    // admins; earlier we blocked edits/deletes of admins when
                    // logged in as manager which prevented the reported
                    // behaviour.  We'll keep the simple rule: if you're a manager
                    // or admin, show the buttons.
                    const showActions = isAdmin || isManager;

                    return (
                      <tr
                        key={u._id}
                        className="hover:bg-slate-50 transition-colors group"
                      >
                        {/* username */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-600 font-bold text-sm flex-shrink-0">
                              {u.name?.charAt(0)?.toUpperCase() || u.username?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-800">{u.username}</span>
                          </div>
                        </td>

                        {/* name */}
                        <td className="px-6 py-4 text-slate-700 font-medium">{u.name}</td>

                        {/* email */}
                        <td className="px-6 py-4 text-slate-500">{u.email}</td>

                        {/* role */}
                        <td className="px-6 py-4">
                          <RoleBadge role={u.role} />
                        </td>

                        {/* actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {showActions ? (
                              <>
                                <button
                                  onClick={() => handleEdit(u)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg ring-1 ring-blue-200 transition"
                                >
                                  <FaEdit size={11} /> Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(u._id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg ring-1 ring-red-200 transition"
                                >
                                  <FaTrash size={11} /> Excluir
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-300 italic">Sem permissão</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Modal Form ─────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

            {/* modal header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-600 text-white">
                  {editingUser ? <FaEdit size={15} /> : <FaUserPlus size={15} />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {editingUser ? 'Altere os dados do usuário' : 'Preencha os dados para criar a conta'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* modal body */}
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Username */}
                <Field label="Nome de usuário" required>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input-base"
                    placeholder="nome.usuario"
                    disabled={!!editingUser}
                  />
                </Field>

                {/* E-mail */}
                <Field label="E-mail" required>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-base"
                    placeholder="email@empresa.com"
                  />
                </Field>

                {/* Nome Completo */}
                <Field label="Nome completo" required>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-base"
                    placeholder="Nome Sobrenome"
                  />
                </Field>

                {/* Perfil */}
                <Field label="Perfil de acesso" required>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-base bg-white"
                  >
                    <option value="driver">Motorista</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Administrador</option>
                    <option value="geomar">GeoMar</option>
                    <option value="gestor_contratado">Gestor Contratado</option>
                  </select>
                </Field>

                {/* Contratado — apenas para gestor_contratado */}
                {formData.role === 'gestor_contratado' && (
                  <Field label="Contratado" required>
                    <select
                      value={formData.contratado || ''}
                      onChange={(e) => setFormData({ ...formData, contratado: e.target.value || null })}
                      className="input-base bg-white"
                    >
                      <option value="">Selecione um contratado...</option>
                      {contractors.length > 0 ? (
                        contractors.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      ) : (
                        <option disabled>Nenhum contratado disponível</option>
                      )}
                    </select>
                  </Field>
                )}

                {/* Cidade — para todos exceto Gerente */}
                {formData.role !== 'manager' && (
                  <Field label="Cidade" required>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="input-base bg-white"
                    >
                      <option value="manaus">Manaus</option>
                      <option value="itajai">Itajaí</option>
                    </select>
                  </Field>
                )}

                {/* Senha — apenas criação */}
                {!editingUser && (
                  <Field label="Senha" required className="md:col-span-2">
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-base"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </Field>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition"
                >
                  <FaSave size={13} />
                  {editingUser ? 'Salvar alterações' : 'Criar usuário'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition"
                >
                  <FaTimes size={13} />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

/* ─── tiny helpers ─────────────────────────────────────────────────────── */

/** Wrapper de campo do formulário */
const Field = ({ label, required, children, className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

export default UserManagement;
