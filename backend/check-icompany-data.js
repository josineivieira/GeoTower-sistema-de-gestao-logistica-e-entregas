require('dotenv').config();
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/logistica';
console.log('💾 Conectando ao banco:', mongoUri.substring(0, 50) + '...');

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('✅ Conectado ao MongoDB!');
    
    const Icompany = require('./src/models/Icompany');
    
    try {
      const totalCount = await Icompany.countDocuments({});
      const manausCount = await Icompany.countDocuments({ city: 'manaus' });
      const itajaiCount = await Icompany.countDocuments({ city: 'itajai' });
      const noCity = await Icompany.countDocuments({ city: { $exists: false } });
      
      console.log('\n📋 Contagem de Registros:');
      console.log('  Total geral:', totalCount);
      console.log('  Em Manaus:', manausCount);
      console.log('  Em Itajaí:', itajaiCount);
      console.log('  Sem city:', noCity);
      
      if (totalCount > 0) {
        const sample = await Icompany.findOne({}).lean();
        console.log('\n📄 Exemplo de registro:');
        console.log('  Campos:', Object.keys(sample).slice(0, 10).join(', '), '...');
      } else {
        console.log('\n⚠️ NENHUM REGISTRO ENCONTRADO}');
      }
    } catch (err) {
      console.error('❌ Erro ao contar:', err.message);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('❌ Erro de conexão:', err.message);
    process.exit(1);
  });
