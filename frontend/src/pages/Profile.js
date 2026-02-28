import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { FaSave, FaKey, FaUser, FaArrowLeft, FaEnvelope, FaPhone, FaLock, FaEye, FaEyeSlash, FaCheckCircle } from 'react-icons/fa';
import { authService } from '../services/authService';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });

  useEffect(() => {
    (async () => {
      try {
        const resp = await authService.getMe();
        const d = resp.data.driver;
        setForm({ name: d.fullName || d.name || '', email: d.email || '', phone: d.phone || '' });
      } catch (err) {
        setToast({ message: 'Erro ao carregar perfil', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setSavingProfile(true);
      const resp = await authService.updateProfile({ name: form.name, email: form.email, phone: form.phone });
      setToast({ message: resp.data.message || 'Perfil atualizado com sucesso', type: 'success' });
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Erro ao atualizar perfil', type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwd.newPassword !== pwd.confirm)
      return setToast({ message: 'As senhas não conferem', type: 'error' });
    if (pwd.newPassword.length < 6)
      return setToast({ message: 'A nova senha deve ter pelo menos 6 caracteres', type: 'error' });
    try {
      setSavingPwd(true);
      const resp = await authService.changePassword({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword });
      setToast({ message: resp.data.message || 'Senha alterada com sucesso', type: 'success' });
      setPwd({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Erro ao alterar senha', type: 'error' });
    } finally {
      setSavingPwd(false);
    }
  };

  const passwordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6) return { label: 'Fraca', color: '#ef4444', width: '25%' };
    if (p.length < 10 && !/[A-Z]/.test(p)) return { label: 'Média', color: '#f59e0b', width: '55%' };
    return { label: 'Forte', color: '#10b981', width: '100%' };
  };
  const strength = passwordStrength(pwd.newPassword);

  const inputWrap = { display: 'flex', flexDirection: 'column', gap: 6 };
  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '.6px'
  };
  const fieldStyle = {
    position: 'relative', display: 'flex', alignItems: 'center'
  };
  const inputStyle = {
    width: '100%', padding: '11px 14px 11px 42px', fontSize: 14,
    border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none',
    backgroundColor: '#fff', color: '#1f2937',
    transition: 'border-color .2s', boxSizing: 'border-box'
  };
  const iconStyle = {
    position: 'absolute', left: 14, color: '#9ca3af', fontSize: 15, zIndex: 1
  };
  const Card = ({ children, style }) => (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '28px 32px',
      border: '1px solid #e5e7eb', boxShadow: '0 2px 16px rgba(0,0,0,.06)',
      ...style
    }}>
      {children}
    </div>
  );

  const initials = form.name
    ? form.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'U';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        padding: '0 32px', height: 72,
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 4px 20px rgba(49,46,129,.4)'
      }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)',
            background: 'rgba(255,255,255,.08)', color: '#e0e7ff',
            cursor: 'pointer', fontSize: 13, fontWeight: 500
          }}
        >
          <FaArrowLeft size={12} /> Voltar
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
            Configurações de Perfil
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#a5b4fc', marginTop: 2 }}>
            Gerencie seus dados e segurança
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 24px 60px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            Carregando perfil...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Avatar Card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(99,102,241,.35)'
                }}>
                  {initials}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1f2937' }}>{form.name || 'Usuário'}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>{form.email || '—'}</p>
                </div>
              </div>
            </Card>

            {/* Personal Data Card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FaUser style={{ color: '#6366f1', fontSize: 15 }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Dados Pessoais</h2>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Atualize suas informações de contato</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Name */}
                <div style={{ ...inputWrap, gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Nome completo</label>
                  <div style={fieldStyle}>
                    <FaUser style={iconStyle} />
                    <input
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      placeholder="Seu nome completo"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Email */}
                <div style={inputWrap}>
                  <label style={labelStyle}>E-mail</label>
                  <div style={fieldStyle}>
                    <FaEnvelope style={iconStyle} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                      placeholder="seu@email.com"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div style={inputWrap}>
                  <label style={labelStyle}>Telefone</label>
                  <div style={fieldStyle}>
                    <FaPhone style={iconStyle} />
                    <input
                      value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})}
                      placeholder="(00) 00000-0000"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => navigate('/home')}
                  style={{
                    padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                    border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={savingProfile}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff', cursor: savingProfile ? 'not-allowed' : 'pointer',
                    opacity: savingProfile ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(99,102,241,.35)'
                  }}
                >
                  <FaSave size={13} />
                  {savingProfile ? 'Salvando...' : 'Salvar Dados'}
                </button>
              </div>
            </Card>

            {/* Password Card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FaKey style={{ color: '#d97706', fontSize: 15 }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Segurança</h2>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Altere sua senha de acesso</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                {/* Old password */}
                <div style={inputWrap}>
                  <label style={labelStyle}>Senha atual</label>
                  <div style={fieldStyle}>
                    <FaLock style={iconStyle} />
                    <input
                      type={showPwd.old ? 'text' : 'password'}
                      value={pwd.oldPassword}
                      onChange={e => setPwd({...pwd, oldPassword: e.target.value})}
                      placeholder="Digite sua senha atual"
                      style={{ ...inputStyle, paddingRight: 44 }}
                    />
                    <button
                      onClick={() => setShowPwd({...showPwd, old: !showPwd.old})}
                      style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
                    >
                      {showPwd.old ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div style={inputWrap}>
                  <label style={labelStyle}>Nova senha</label>
                  <div style={fieldStyle}>
                    <FaLock style={iconStyle} />
                    <input
                      type={showPwd.new ? 'text' : 'password'}
                      value={pwd.newPassword}
                      onChange={e => setPwd({...pwd, newPassword: e.target.value})}
                      placeholder="Mínimo 6 caracteres"
                      style={{ ...inputStyle, paddingRight: 44 }}
                    />
                    <button
                      onClick={() => setShowPwd({...showPwd, new: !showPwd.new})}
                      style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
                    >
                      {showPwd.new ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {strength && (
                    <div>
                      <div style={{ height: 4, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ height: '100%', width: strength.width, backgroundColor: strength.color, transition: 'width .3s, background-color .3s', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11, color: strength.color, fontWeight: 600, marginTop: 4, display: 'block' }}>
                        Força: {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div style={inputWrap}>
                  <label style={labelStyle}>Confirmar nova senha</label>
                  <div style={fieldStyle}>
                    <FaLock style={iconStyle} />
                    <input
                      type={showPwd.confirm ? 'text' : 'password'}
                      value={pwd.confirm}
                      onChange={e => setPwd({...pwd, confirm: e.target.value})}
                      placeholder="Repita a nova senha"
                      style={{
                        ...inputStyle, paddingRight: 44,
                        borderColor: pwd.confirm && pwd.confirm !== pwd.newPassword ? '#fca5a5' : undefined
                      }}
                    />
                    <button
                      onClick={() => setShowPwd({...showPwd, confirm: !showPwd.confirm})}
                      style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
                    >
                      {showPwd.confirm ? <FaEyeSlash /> : <FaEye />}
                    </button>
                    {pwd.confirm && pwd.confirm === pwd.newPassword && (
                      <FaCheckCircle style={{ position: 'absolute', right: 40, color: '#10b981', fontSize: 14 }} />
                    )}
                  </div>
                  {pwd.confirm && pwd.confirm !== pwd.newPassword && (
                    <span style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>As senhas não conferem</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleChangePassword}
                  disabled={savingPwd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: 'none',
                    background: 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#fff', cursor: savingPwd ? 'not-allowed' : 'pointer',
                    opacity: savingPwd ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(217,119,6,.3)'
                  }}
                >
                  <FaKey size={13} />
                  {savingPwd ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
      `}</style>
    </div>
  );
};

export default Profile;
