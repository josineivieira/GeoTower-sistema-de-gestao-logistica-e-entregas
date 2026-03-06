require('dotenv').config();
const mongoose = require('mongoose');
const Ycompany = require('./src/models/Ycompany');
const ProgramacaoEntrega = require('./src/models/ProgramacaoEntrega');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🔄 SIMULANDO SINCRONIZAÇÃO...\n');
    
    // Buscar todos os registros do Ycompany
    const ycompanyRecords = await Ycompany.find({}).lean();
    console.log(`📥 Carregados ${ycompanyRecords.length} registros do Ycompany`);

    // Buscar todos os processos já existentes para evitar duplicação
    const existingProcessos = await ProgramacaoEntrega.find({}).select('processo').lean();
    const existingProcessosSet = new Set(existingProcessos.map(p => String(p.processo || '').trim().toUpperCase()));

    console.log(`📋 Encontrados ${existingProcessosSet.size} processos já existentes`);

    // Mapear dados do Ycompany para Programação de Entregas
    const novosRegistros = ycompanyRecords
      .filter(y => {
        // Filtrar registros que já existem
        const processo = String(y.processo || '').trim().toUpperCase();
        return processo && !existingProcessosSet.has(processo);
      })
      .map(y => ({
        processo: String(y.processo || '').trim(),
        recebedor: String(y.destinatario || '').trim() || 'N/A',
        container: String(y.containerNumero || '').trim() || '',
        dataAgendamento: y.dtAgendamentoDescarga 
          ? new Date(y.dtAgendamentoDescarga).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16),
        contratado: String(y.contratado || '').trim() || 'OUTRO',
        motorista: String(y.motorista || '').trim() || '',
        status: 'AGENDADO',
        observacoes: `Sincronizado do Ycompany - ${y.situacao || 'N/A'}`
      }));

    console.log(`✅ ${novosRegistros.length} novos registros para sincronizar`);
    
    // MOSTRAR O QUE SERÁ INSERIDO
    console.log('\n📄 AMOSTRA DOS REGISTROS A SINCRONIZAR:');
    novosRegistros.slice(0, 3).forEach((reg, i) => {
      console.log(`\n  [${i+1}]`);
      console.log(`    Processo: ${reg.processo}`);
      console.log(`    Recebedor: ${reg.recebedor}`);
      console.log(`    Container: ${reg.container}`);
      console.log(`    Contratado: ${reg.contratado}`);
      console.log(`    Motorista: ${reg.motorista}`);
      console.log(`    Status: ${reg.status}`);
    });
    
    // FAZER A INSERÇÃO
    if (novosRegistros.length > 0) {
      console.log(`\n\n⏳ Inserindo ${novosRegistros.length} registros...`);
      const inserted = await ProgramacaoEntrega.insertMany(novosRegistros, { ordered: false });
      console.log(`\n✅ ✅ ✅ SUCESSO! ${inserted.length} registros sincronizados!`);
      
      // CONFIRMAÇÃO
      const totalAgora = await ProgramacaoEntrega.countDocuments();
      console.log(`\n📊 Total em Programações agora: ${totalAgora}`);
    } else {
      console.log('\n⚠️ Nenhum registro novo para sincronizar');
    }
    
    process.exit(0);
  } catch(e) {
    console.error('❌ ERRO:', e.message);
    process.exit(1);
  }
})();
