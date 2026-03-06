require('dotenv').config();
const mongoose = require('mongoose');
const Ycompany = require('./src/models/Ycompany');
const ProgramacaoEntrega = require('./src/models/ProgramacaoEntrega');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n=== DIAGNOSTICO SYNC (CORRIGIDO) ===');
    
    const ycCount = await Ycompany.countDocuments();
    const progCount = await ProgramacaoEntrega.countDocuments();
    
    console.log('\n📊 CONTAGEM:');
    console.log('  Ycompany total:', ycCount);
    console.log('  Programacoes total:', progCount);
    
    // Busca amostra do Ycompany
    const ycSample = await Ycompany.find({}).select('processo destinatario containerNumero contratado motorista').limit(3).lean();
    console.log('\n📝 AMOSTRA YCOMPANY (com campo PROCESSO correto):');
    ycSample.forEach((s, i) => {
      console.log(`  [${i+1}]`);
      console.log(`    ✓ processo: "${s.processo}"`);
      console.log(`    ✓ destinatario: "${s.destinatario}"`);
      console.log(`    ✓ containerNumero: "${s.containerNumero}"`);
      console.log(`    ✓ contratado: "${s.contratado}"`);
      console.log(`    ✓ motorista: "${s.motorista}"`);
    });
    
    // Busca processos existentes
    const existingProcs = await ProgramacaoEntrega.find({}).select('processo').limit(5).lean();
    console.log('\n💾 PROCESSOS EXISTENTES EM PROGRAMACAO:');
    existingProcs.forEach((p, i) => {
      console.log(`  [${i+1}] "${p.processo}"`);
    });
    
    // Verifica quais processos já existem vs Ycompany
    const yprocessos = await Ycompany.distinct('processo');
    const yprocessosUnicos = yprocessos.filter(p => p && String(p).trim().length > 0);
    console.log('\n🔍 PROCESSOS UNICOS NO YCOMPANY:', yprocessosUnicos.length);
    yprocessosUnicos.slice(0, 5).forEach((p, i) => {
      console.log(`  [${i+1}] "${p}"`);
    });
    
    // Simula o filtro de duplicação
    const programUpper = existingProcs.map(p => String(p.processo).toUpperCase().trim());
    const canSync = yprocessosUnicos.filter(ypro => !programUpper.includes(String(ypro).toUpperCase().trim()));
    console.log('\n✅ REGISTROS QUE PODEM SER SINCRONIZADOS:', canSync.length);
    canSync.slice(0, 5).forEach((p, i) => {
      console.log(`  [${i+1}] "${p}"`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('❌ ERRO:', e.message);
    console.error(e);
    process.exit(1);
  }
})();
