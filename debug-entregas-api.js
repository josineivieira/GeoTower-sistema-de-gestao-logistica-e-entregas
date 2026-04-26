const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

async function debugEntregas() {
  try {
    const entregas = ['MNBU3383801', 'ECMU5241902', 'ECMU5241841'];
    
    console.log('🔍 INVESTIGANDO ENTREGAS QUE NÃO SUMIRAM:\n');
    
    for (const numero of entregas) {
      try {
        console.log(`\n📦 Entrega: ${numero}`);
        console.log('─'.repeat(50));
        
        // Buscar delivery
        const deliveryRes = await axios.get(`${API_URL}/deliveries`, {
          params: { q: numero }
        }).catch(err => {
          console.log('   ⚠️ Erro ao buscar delivery pela API');
          return null;
        });
        
        if (deliveryRes?.data?.deliveries) {
          const delivery = deliveryRes.data.deliveries[0];
          if (delivery) {
            console.log(`   ✅ Delivery encontrado:`);
            console.log(`      Status: ${delivery.status}`);
            console.log(`      containerReturned: ${delivery.containerReturned}`);
            console.log(`      horarioDevolucaoVazio: ${delivery.horarioDevolucaoVazio}`);
            console.log(`      Docs devolucaoVazio: ${delivery.documents?.devolucaoVazio?.length || 0}`);
            console.log(`      Docs devolucaoContainerVazio: ${delivery.documents?.devolucaoContainerVazio?.length || 0}`);
            
            const hasMarker1 = delivery.observations?.includes('(CONTAINER_VAZIO_DEVOLVIDO)');
            const hasMarker2 = delivery.observations?.includes('(Baixa_Container)');
            if (hasMarker1 || hasMarker2) {
              console.log(`      ✅ Markers encontrados:`);
              if (hasMarker1) console.log(`         - CONTAINER_VAZIO_DEVOLVIDO`);
              if (hasMarker2) console.log(`         - Baixa_Container`);
            } else {
              console.log(`      ❌ Sem markers na observação (BUG?)`);
            }
          }
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message}`);
      }
    }
    
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

debugEntregas();
