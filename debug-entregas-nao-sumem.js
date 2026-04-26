const mongoose = require('mongoose');

// Conectar ao MongoDB
const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/icompany';

async function debugEntregas() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('✅ Conectado ao MongoDB');

    const db = mongoose.connection.db;
    
    // Números das entregas que não sumiram
    const entregas = ['MNBU3383801', 'ECMU5241902', 'ECMU5241841'];
    
    console.log('\n📦 VERIFICANDO PROGRAMAÇÕES:\n');
    
    for (const numero of entregas) {
      const prog = await db.collection('programacaoentregas').findOne({
        $or: [
          { container: numero },
          { processo: numero }
        ]
      });
      
      if (prog) {
        console.log(`\n🔍 ${numero}:`);
        console.log(`   Status: ${prog.status}`);
        console.log(`   containerReturned: ${prog.containerReturned}`);
        console.log(`   _id: ${prog._id}`);
        console.log(`   linkedDeliveryId: ${prog.linkedDeliveryId}`);
      } else {
        console.log(`\n❌ ${numero}: Programação não encontrada`);
      }
    }
    
    console.log('\n\n📋 VERIFICANDO DELIVERIES:\n');
    
    for (const numero of entregas) {
      const delivery = await db.collection('deliveries').findOne({
        deliveryNumber: numero.toUpperCase()
      });
      
      if (delivery) {
        console.log(`\n🔍 ${numero}:`);
        console.log(`   Status: ${delivery.status}`);
        console.log(`   containerReturned: ${delivery.containerReturned}`);
        console.log(`   horarioDevolucaoVazio: ${delivery.horarioDevolucaoVazio}`);
        console.log(`   Documentos devolucaoVazio:`, delivery.documents?.devolucaoVazio?.length || 0);
        console.log(`   Documentos devolucaoContainerVazio:`, delivery.documents?.devolucaoContainerVazio?.length || 0);
        console.log(`   Observações marker: ${
          delivery.observations?.includes('(CONTAINER_VAZIO_DEVOLVIDO)') ? '✅ CONTAINER_VAZIO_DEVOLVIDO' : ''
        }${
          delivery.observations?.includes('(Baixa_Container)') ? '✅ Baixa_Container' : ''
        }`);
        console.log(`   Observações: ${delivery.observations?.substring(0, 100)}...`);
      } else {
        console.log(`\n❌ ${numero}: Delivery não encontrado`);
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Desconectado do MongoDB');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

debugEntregas();
