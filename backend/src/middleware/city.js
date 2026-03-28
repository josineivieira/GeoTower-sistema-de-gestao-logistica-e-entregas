module.exports = function cityMiddleware(req, res, next) {
  let city = req.header('x-city') || req.query.city || req.body?.city || 'manaus';
  city = String(city || 'manaus').toLowerCase();
  if (city !== 'manaus' && city !== 'itajai' && city !== 'both') city = 'manaus';
  req.city = city;
  
  // Usa adapter com fallback automático MongoDB → MockDB
  // Se MONGODB_URI estiver configurado, tenta MongoDB
  // Se falhar ou não estiver configurado, cai para MockDB automaticamente
  const dbAdapter = require('../mongodbAdapterWithFallback');
  req.mockdb = dbAdapter.forCity(city);
  
  next();
};
