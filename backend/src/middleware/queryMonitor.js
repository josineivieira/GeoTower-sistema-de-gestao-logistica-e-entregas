/**
 * queryMonitor.js
 * Middleware para monitorar e logar queries Mongoose lentas
 * Identifica operações acima do threshold de 100ms
 */

const mongoose = require('mongoose');

const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100'); // ms

module.exports = (options = {}) => {
  const threshold = options.threshold || SLOW_QUERY_THRESHOLD;
  const logSlowQueries = options.logSlowQueries !== false;
  const verbose = options.verbose === true;

  return (req, res, next) => {
    if (!logSlowQueries) {
      return next();
    }

    // Setup Mongoose debug
    let startTime;

    mongoose.set('debug', (collection, method, query, doc, options) => {
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        const queryStr = JSON.stringify(query).slice(0, 150);
        console.warn(
          `⚠️  SLOW_QUERY [${duration}ms] ${collection}.${method}: ${queryStr}`
        );
        
        // Sugerir índices se query tiver filtros
        if (method === 'find' || method === 'findOne') {
          if (query && Object.keys(query).length > 0) {
            console.warn(`   💡 Sugestão: criar índice para campos:`, 
              Object.keys(query).join(', '));
          }
        }
      } else if (verbose) {
        console.log(`✓ query [${duration}ms] ${collection}.${method}`);
      }

      startTime = Date.now();
    });

    // Set start time
    startTime = Date.now();

    next();
  };
};

/**
 * Função para gerar relatório de índices recomendados
 */
exports.suggestIndexes = async () => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('\n📊 Índices Existentes:\n');
    
    for (const collection of collections) {
      const coll = mongoose.connection.db.collection(collection.name);
      const indexes = await coll.getIndexes();
      
      console.log(`${collection.name}:`);
      Object.entries(indexes).forEach(([name, spec]) => {
        console.log(`  ${name}:`, spec);
      });
    }
  } catch (error) {
    console.error('Erro ao listar índices:', error);
  }
};

/**
 * Função para criar índices automaticamente se não existirem
 */
exports.ensureIndexes = async () => {
  try {
    console.log('🔍 Garantindo índices do Mongoose...');
    
    // Delivery
    await require('../models/Delivery').syncIndexes();
    console.log('✓ Delivery indexes OK');
    
    // ProgramacaoEntrega
    await require('../models/ProgramacaoEntrega').syncIndexes();
    console.log('✓ ProgramacaoEntrega indexes OK');
    
    // Motorista
    await require('../models/Motorista').syncIndexes();
    console.log('✓ Motorista indexes OK');
    
    // Icompany
    await require('../models/Icompany').syncIndexes();
    console.log('✓ Icompany indexes OK');
  } catch (error) {
    console.error('❌ Erro ao garantir índices:', error);
  }
};
