const mongoose = require('mongoose');
const Programacao = require('./src/models/ProgramacaoEntrega');

(async () => {
  try {
    const uri = process.env.MONGODB_URI || '';
    console.log('connecting to', uri);
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const docs = await Programacao.find().limit(5).lean();
    console.log('sample programacoes', docs);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();