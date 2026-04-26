const mongoose = require('mongoose');

const MONGODB_URI = 'MONGODB_URI_REMOVED';

async function debugEntregas() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('? Conectado ao MongoDB\n');

    const db = mongoose.connection.db;
    const entregas = ['MNBU3383801', 'ECMU5241902', 'ECMU5241841'];
    
    console.log('?? INVESTIGANDO ENTREGAS QUE NÃO SUMIRAM:\n');
    
    for (const numero of entregas) {
      console.log(\n?? Entrega: );
      console.log('-'.repeat(50));
      
      // Search in deliveries collection
      const delivery = await db.collection('deliveries').findOne({
        $or: [
          { numero: numero },
          { 'numero': { $regex: numero, $options: 'i' } }
        ]
      });
      
      if (delivery) {
        console.log(   ? Encontrado em deliveries:);
        console.log(      Status: );
        console.log(      containerReturned: );
        console.log(      horarioDevolucaoVazio: );
        console.log(      Docs devolucaoVazio: );
        console.log(      Docs devolucaoContainerVazio: );
        
        const hasMarker1 = delivery.observations?.includes('(CONTAINER_VAZIO_DEVOLVIDO)');
        const hasMarker2 = delivery.observations?.includes('(Baixa_Container)');
        if (hasMarker1 || hasMarker2) {
          console.log(      ? Markers encontrados:);
          if (hasMarker1) console.log(         - CONTAINER_VAZIO_DEVOLVIDO);
          if (hasMarker2) console.log(         - Baixa_Container);
        } else {
          console.log(      ? Sem markers especiais);
        }
        console.log(      Observações: );
      } else {
        console.log(   ? Não encontrado em deliveries);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('? Erro:', error.message);
  }
}

debugEntregas();
