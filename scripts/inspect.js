const mongoose = require('mongoose');
const Programacao = require('../backend/src/models/ProgramacaoEntrega');

(async () => {
  try {
    const uri = process.env.MONGODB_URI || '';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const docs = await Programacao.find().limit(10).lean();
    console.log('sample programacoes', docs);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();