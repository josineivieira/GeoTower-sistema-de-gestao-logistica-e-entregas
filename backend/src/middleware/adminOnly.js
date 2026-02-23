const adminOnly = (req, res, next) => {
  try {
    const role = req.user?.role;
    if (!role || role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Acesso restrito a administradores' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

module.exports = adminOnly;
