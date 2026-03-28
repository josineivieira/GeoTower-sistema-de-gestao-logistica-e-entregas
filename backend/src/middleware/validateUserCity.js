/**
 * Middleware para validar se o usuário tem permissão de acessar a cidade solicitada
 * - Se user.city = 'both': acesso a qualquer cidade
 * - Se user.city = 'manaus' ou 'itajai': acesso apenas àquela cidade
 * - Se user.city = null: acesso padrão a 'manaus' (compatibilidade com usuários antigos)
 */
module.exports = function validateUserCity(req, res, next) {
  if (!req.user) {
    // Sem autenticação, deixa passar (pode ser validado por outro middleware)
    return next();
  }

  const userCity = req.user.city || 'manaus';
  const requestCity = req.city || 'manaus';

  // Se user tem acesso a ambas as cidades, permite qualquer requisição
  if (userCity === 'both') {
    return next();
  }

  // Se user tem cidade específica, valida contra a cidade da requisição
  if (userCity !== requestCity) {
    return res.status(403).json({ 
      message: `Acesso negado. Seu usuário tem permissão apenas para ${userCity}` 
    });
  }

  next();
};
