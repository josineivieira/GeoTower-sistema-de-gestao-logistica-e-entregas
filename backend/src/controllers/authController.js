const mockdb = require('../mockdb');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const isProduction = process.env.NODE_ENV === 'production';

const generateToken = (userId, name, role, contratado = null, city = null) => {
  // Expira em 8 horas
  const payload = { id: userId, name, role };
  if (contratado) {
    payload.contratado = contratado;
  }
  if (city) {
    payload.city = city;
  }
  const secret = process.env.JWT_SECRET || (isProduction ? null : 'dev_secret_change_me');
  if (!secret) {
    throw new Error('JWT_SECRET nao configurado');
  }

  return jwt.sign(payload, secret, { expiresIn: '8h' });
};

const hashPassword = (pwd) => {
  return crypto.createHash('sha256').update(pwd).digest('hex');
};


// Register a new driver
exports.register = async (req, res) => {
  try {
    const { name, username, email, password, phone } = req.body;
    const db = req.mockdb;

    // Check if driver already exists
    const existingDriver = await db.findOne('drivers', { 
      $or: [{ email }, { username }] 
    });

    if (existingDriver) {
      return res.status(400).json({ success: false, message: 'Motorista já cadastrado' });
    }

    // Create new driver
    // Debug logs: show request body (mask password) and which collection we'll use
    try {
      console.log('[REGISTER] body:', { ...req.body, password: req.body?.password ? '***' : undefined });
    } catch (e) {
      console.warn('[REGISTER] could not log body', e && e.message);
    }
    try {
      console.log('[REGISTER] model:', (db && db.collectionName) || 'drivers');
    } catch (e) {
      console.warn('[REGISTER] could not log model', e && e.message);
    }

    // If using MongoDB, let mongoose handle bcrypt hashing by providing plain password.
    // For MockDB (file-backed), store SHA256 to remain compatible.
    const passwordToStore = process.env.MONGODB_URI ? password : hashPassword(password);
    const driver = await db.create('drivers', {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: passwordToStore,
      name,
      fullName: name,
      phone,
      role: 'driver',
      isActive: true
    });

    try {
      console.log('[REGISTER] saved id:', driver?._id);
    } catch (e) {
      console.warn('[REGISTER] could not log saved id', e && e.message);
    }

    try {
      const allDrivers = await db.find('drivers', {});
      const total = Array.isArray(allDrivers) ? allDrivers.length : (allDrivers && allDrivers.count) || (allDrivers && allDrivers.total) || '?';
      console.log('[REGISTER] total drivers agora:', total);
    } catch (e) {
      console.warn('[REGISTER] could not get drivers total', e && e.message);
    }

    const driverName = driver.name || driver.fullName || driver.username || 'Usuário';
    const token = generateToken(driver._id, driverName, driver.role, driver.contratado || null, driver.city || null);

    res.status(201).json({
      success: true,
      message: 'Motorista cadastrado com sucesso',
      token,
      driver: {
        id: driver._id,
        username: driver.username,
        email: driver.email,
        fullName: driver.fullName || driver.name || '',
        name: driver.name || driver.fullName || '',
        role: driver.role,
        city: driver.city || null
      }
    });
  } catch (error) {
    console.error('Erro register:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = req.mockdb;
    
    // Debug: log incoming city / header to help diagnose mobile/ngrok issues
    if (!isProduction) console.log('🔐 LOGIN ATTEMPT:', { username, passwordLength: password?.length });
    if (!isProduction) console.log('🔎 Request headers city:', req.header('x-city'), 'resolved req.city:', req.city, 'origin:', req.headers.origin);

    // Validate input
    if (!username || !password) {
      if (!isProduction) console.log('❌ Missing credentials');
      return res.status(400).json({ success: false, message: 'Usuário e senha obrigatórios' });
    }

    // Allow login by username or email (case-insensitive)
    const loginKey = String(username).toLowerCase();

    let driver = null;
    driver = await db.findOne('drivers', { username: loginKey });
    if (!driver) driver = await db.findOne('drivers', { email: loginKey });

    if (!isProduction) console.log('👤 Driver found:', driver ? driver.username : 'NOT FOUND');
    if (!isProduction) console.log('🔐 Driver password type:', driver?.password ? (driver.password.startsWith('$2') ? 'bcrypt' : 'sha256/other') : 'no password');

    if (!driver) {
      if (!isProduction) console.log('❌ Driver not found for:', loginKey);
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    // Check password: support legacy SHA256 (mockdb) and bcrypt (MongoDB)
    const hashedSha256 = hashPassword(password);
    let passwordMatch = false;

    // 1) explicit legacy field
    if (driver.legacyPasswordSha256) {
      passwordMatch = (hashedSha256 === driver.legacyPasswordSha256);
      if (passwordMatch) {
        try {
          const bcryptHash = await bcrypt.hash(password, 10);
          await db.updateOne('drivers', { _id: driver._id }, { password: bcryptHash, legacyPasswordSha256: null });
        } catch (e) {
          console.warn('⚠️ Failed to migrate legacy password to bcrypt:', e && e.message ? e.message : e);
        }
      }
    } else {
      // 2) handle case where SHA256 was stored in `password` field (legacy mockdb)
      const maybeLegacySha = typeof driver.password === 'string' && /^[0-9a-f]{64}$/i.test(driver.password);
      if (maybeLegacySha) {
        passwordMatch = (hashedSha256 === driver.password);
        if (passwordMatch) {
          try {
            const bcryptHash = await bcrypt.hash(password, 10);
            await db.updateOne('drivers', { _id: driver._id }, { password: bcryptHash, legacyPasswordSha256: null });
          } catch (e) {
            console.warn('⚠️ Failed to migrate legacy password-stored-in-password to bcrypt:', e && e.message ? e.message : e);
          }
        }
      } else {
        // 3) assume bcrypt
        try {
          passwordMatch = await bcrypt.compare(password, driver.password || '');
          if (!isProduction) console.log('bcrypt.compare result:', passwordMatch);
        } catch (e) {
          console.error('Error comparing bcrypt password:', e);
        }
      }
    }

    // Additional attempt: some records were saved as bcrypt(sha256(password)) when
    // registration used sha256 before mongoose hashing. Try matching hashedSha256 against bcrypt hash.
    if (!passwordMatch) {
      try {
        passwordMatch = await bcrypt.compare(hashedSha256, driver.password || '');
        if (passwordMatch) {
          // migrate to bcrypt of plain password
          try {
            const bcryptHash = await bcrypt.hash(password, 10);
            await db.updateOne('drivers', { _id: driver._id }, { password: bcryptHash, legacyPasswordSha256: null });
          } catch (e) {
            console.warn('⚠️ Failed to migrate bcrypt(sha256) to bcrypt(plain):', e && e.message ? e.message : e);
          }
        }
      } catch (e) {
        console.error('Error comparing bcrypt with sha256 value:', e);
      }
    }

    if (!isProduction) console.log('Password check:', { passwordMatch });
    if (!passwordMatch) {
      if (!isProduction) console.log('❌ Password mismatch');
      return res.status(401).json({ success: false, message: 'Senha incorreta' });
    }

    // Check if driver is active
    if (!driver.isActive) {
      if (!isProduction) console.log('❌ Driver inactive');
      return res.status(401).json({ success: false, message: 'Motorista desativado' });
    }

    const driverName = driver.name || driver.fullName || driver.username || 'Usuário';
    const token = generateToken(driver._id, driverName, driver.role, driver.contratado || null, driver.city || null);
    if (!isProduction) console.log('✅ Login success:', driver.username);
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      driver: {
        id: driver._id,
        username: driver.username,
        email: driver.email,
        fullName: driver.fullName || driver.name || '',
        name: driver.name || driver.fullName || '',
        role: driver.role,
        contratado: driver.contratado || null,
        city: driver.city || null
      }
    });
  } catch (error) {
    console.error('❌ Erro login:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get current driver
exports.getMe = async (req, res) => {
  try {
    const db = req.mockdb;
    const driver = await db.findById('drivers', req.user.id);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Motorista não encontrado' });
    }

    res.json({
      success: true,
      driver: {
        id: driver._id,
        username: driver.username,
        email: driver.email,
        fullName: driver.fullName || driver.name || '',
        name: driver.name || driver.fullName || '',
        role: driver.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Get all drivers (admin only)
exports.getAllDrivers = async (req, res) => {
  try {
    const db = req.mockdb;
    const drivers = await db.find('drivers', { role: 'driver' });
    res.json({
      success: true,
      drivers: drivers.map(d => ({
        id: d._id,
        username: d.username,
        fullName: d.fullName || d.name || '',
        name: d.name || d.fullName || '',
        email: d.email,
        role: d.role
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Update driver profile
exports.updateDriver = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const db = req.mockdb;
    const driver = await db.updateOne('drivers', { _id: req.user.id }, { name, email, phone });

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Motorista não encontrado' });
    }

    res.json({
      success: true,
      message: 'Perfil atualizado',
      driver: {
        id: driver._id,
        username: driver.username,
        email: driver.email,
        fullName: driver.fullName || driver.name || '',
        name: driver.name || driver.fullName || '',
        role: driver.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const db = req.mockdb;
    const driver = await db.findById('drivers', req.user.id);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Motorista não encontrado' });
    }

    // Accept several stored formats: legacy sha256 in `legacyPasswordSha256`,
    // sha256 stored in `password`, bcrypt(plain) or bcrypt(sha256).
    const hashedOld = hashPassword(oldPassword);
    let ok = false;
    if (driver.legacyPasswordSha256 && driver.legacyPasswordSha256 === hashedOld) ok = true;
    if (!ok && typeof driver.password === 'string' && /^[0-9a-f]{64}$/i.test(driver.password) && driver.password === hashedOld) ok = true;
    if (!ok) {
      try {
        ok = await bcrypt.compare(oldPassword, driver.password || '');
        if (!ok) {
          // also try bcrypt compare against sha256(oldPassword)
          ok = await bcrypt.compare(hashedOld, driver.password || '');
        }
      } catch (e) {
        console.error('Error comparing passwords in changePassword:', e);
      }
    }

    if (!ok) return res.status(401).json({ success: false, message: 'Senha atual incorreta' });

    // Store new password: plain for Mongo (mongoose will hash), sha256 for MockDB
    const newToStore = process.env.MONGODB_URI ? newPassword : hashPassword(newPassword);
    await db.updateOne('drivers', { _id: req.user.id }, { password: newToStore, legacyPasswordSha256: null });

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

// Request password reset (generates token and logs/sends it)
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email obrigatório' });
    const db = req.mockdb;
    const driver = await db.findOne('drivers', { email: String(email).toLowerCase() });
    // Always respond success to avoid user enumeration
    if (!driver) return res.json({ success: true, message: 'Se o email existir, você receberá instruções para recuperar a senha' });

    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000); // 1h

    await db.updateOne('drivers', { _id: driver._id }, { resetPasswordToken: token, resetPasswordExpires: expires });

    // Send email if SMTP configured. In production, never print reset tokens.
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
        const resetUrl = `${process.env.FRONTEND_URL || ''}/reset-password?token=${token}`;
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@example.com',
          to: driver.email,
          subject: 'Recuperação de senha',
          text: `Use o token para recuperar a senha: ${token}\nOu clique: ${resetUrl}`
        });
      } catch (e) {
        console.warn('Failed to send reset email:', e && e.message ? e.message : e);
      }
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('Password reset token for', driver.email, token);
    }

    const resp = { success: true, message: 'Se o email existir, você receberá instruções para recuperar a senha' };
    if (process.env.NODE_ENV !== 'production') resp.token = token;
    return res.json(resp);
  } catch (err) {
    console.error('Error in requestPasswordReset:', err);
    return res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
};

// Reset password using token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token e nova senha obrigatórios' });
    const db = req.mockdb;
    const driver = await db.findOne('drivers', { resetPasswordToken: token });
    if (!driver || !driver.resetPasswordExpires || new Date(driver.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Token inválido ou expirado' });
    }

    const newToStore = process.env.MONGODB_URI ? newPassword : hashPassword(newPassword);
    await db.updateOne('drivers', { _id: driver._id }, { password: newToStore, legacyPasswordSha256: null, resetPasswordToken: null, resetPasswordExpires: null });

    return res.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (err) {
    console.error('Error in resetPassword:', err);
    return res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
};
