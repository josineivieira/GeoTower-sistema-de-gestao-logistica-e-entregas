const managerOnly = (req, res, next) => {
  try {
    const role = req.user?.role;
    // Allow manager and admin
    if (!role || (role !== 'manager' && role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito a gerentes' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

module.exports = managerOnly;
