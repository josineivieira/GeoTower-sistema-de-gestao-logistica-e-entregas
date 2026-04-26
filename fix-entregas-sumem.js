const mongoose = require('mongoose');
const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/icompany';

async function fixEntregas() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('✅ Conectado ao MongoDB\n');

    const ProgramacaoEntrega = require('./backend/src/models/ProgramacaoEntrega');
    
    const numeros = ['MNBU3383801', 'ECMU5241902', 'ECMU5241841'];
    
    console.log('🔧 CORRIGINDO PROGRAMAÇÕES:\n');
    
    for (const numero of numeros) {
      try {
        const prog = await ProgramacaoEntrega.findOne({
          $or: [
            { container: numero },
            { processo: numero }
          ]
        });
        
        if (prog) {
          console.log(`📦 ${numero}:`);
          console.log(`   Status antes: ${prog.status}`);
          console.log(`   containerReturned antes: ${prog.containerReturned}`);
          
          // Marcar como finalizado e containerReturned
          prog.containerReturned = true;
          prog.status = 'FINALIZADO';
          await prog.save();
          
          console.log(`   ✅ Status depois: ${prog.status}`);
          console.log(`   ✅ containerReturned depois: ${prog.containerReturned}\n`);
        } else {
          console.log(`❌ ${numero}: Programação não encontrada\n`);
        }
      } catch (err) {
        console.log(`❌ ${numero}: Erro - ${err.message}\n`);
      }
    }

    await mongoose.connection.close();
    console.log('✅ Desconectado do MongoDB');
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
    process.exit(1);
  }
}

fixEntregas();
