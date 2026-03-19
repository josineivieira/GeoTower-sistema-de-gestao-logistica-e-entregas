/**
 * Script para preencher dtColeta nas programações de Itajaí
 * Usa dataAgendamento como valor padrão para dtColeta caso não esteja preenchido
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectIfNeeded } = require('../src/db/mongo');

async function populateDtColeta() {
  try {
    await connectIfNeeded();
    console.log('🔄 Iniciando preenchimento de dtColeta...');

    const ProgramacaoEntrega = require('../src/models/ProgramacaoEntrega');

    // Buscar todas as programações de Itajaí (aquelas sem origem ou origin diferente de MANAUS)
    const filter = {
      $or: [
        { origem: { $exists: false } },
        { origem: '' },
        { origem: { $nin: ['MANAUS', 'MANAUS - COELTA BALY'] } }
      ],
      // Busca aquelas que não têm dtColeta ou tem como string vazia
      $or: [
        { dtColeta: { $exists: false } },
        { dtColeta: '' },
        { dtColeta: null }
      ]
    };

    const programacoesItajai = await ProgramacaoEntrega.find(filter);
    console.log(`📦 Encontradas ${programacoesItajai.length} programações de Itajaí sem dtColeta`);

    let updated = 0;
    let errors = 0;

    for (const prog of programacoesItajai) {
      try {
        // Se tem dataAgendamento, usa como dtColeta
        if (prog.dataAgendamento) {
          prog.dtColeta = prog.dataAgendamento;
          await prog.save();
          updated++;
          console.log(`  ✅ ${prog.processo}: dtColeta preenchido com ${prog.dataAgendamento}`);
        } else {
          console.log(`  ⚠️  ${prog.processo}: Sem dataAgendamento - pulando`);
        }
      } catch (err) {
        errors++;
        console.error(`  ❌ ${prog.processo}: Erro ao atualizar -`, err.message);
      }
    }

    console.log(`\n✅ Preenchimento concluído: ${updated} atualizadas, ${errors} erros`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

populateDtColeta();
