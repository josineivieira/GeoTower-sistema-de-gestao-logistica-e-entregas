const Driver = require('../models/Driver');

const managerOnly = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.user.id);

    if (!driver || (driver.role !== 'manager' && driver.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Acesso restrito a gerentes' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
  }
};

module.exports = managerOnly;
