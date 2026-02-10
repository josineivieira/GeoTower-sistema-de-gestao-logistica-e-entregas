/**
 * Script para validar integridade dos documentos no MongoDB
 * Identifica entradas com dados faltando (sem path ou name)
 */

const { connectIfNeeded } = require('../src/db/mongo');
const Delivery = require('../src/models/Delivery');

async function main() {
  try {
    // Support both MONGODB_URI and MONGO_URI
    if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
      process.env.MONGODB_URI = process.env.MONGO_URI;
    }
    
    await connectIfNeeded();
    console.log('✓ Conectado ao MongoDB');

    // Buscar todas as entregas
    const deliveries = await Delivery.find({}).lean().exec();
    console.log(`\n📦 Total de entregas: ${deliveries.length}\n`);

    let totalInvalid = 0;
    let problemsByType = {};

    for (const delivery of deliveries) {
      const docs = delivery.documents || {};
      let hasProblems = false;

      for (const [docType, entry] of Object.entries(docs)) {
        if (!entry) continue;

        let docArray = entry;
        if (typeof entry === 'string') {
          try {
            docArray = JSON.parse(entry);
          } catch (e) {
            docArray = [{ path: entry }];
          }
        }

        if (!Array.isArray(docArray)) docArray = [docArray];

        docArray.forEach((doc, idx) => {
          const isValid = doc && (doc.path || doc.id || doc.name);
          if (!isValid) {
            if (!hasProblems) {
              console.log(`❌ Entrega: ${delivery.deliveryNumber} (${delivery._id})`);
              hasProblems = true;
            }
            console.log(`   └─ ${docType}[${idx}]: ${JSON.stringify(doc)}`);
            
            totalInvalid++;
            problemsByType[docType] = (problemsByType[docType] || 0) + 1;
          }
        });
      }

      if (hasProblems) console.log('');
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   Total de documentos inválidos: ${totalInvalid}`);
    console.log(`   Por tipo:`);
    Object.entries(problemsByType).forEach(([type, count]) => {
      console.log(`     - ${type}: ${count}`);
    });

    // Estatísticas gerais
    const entriesWithDocs = deliveries.filter(d => Object.keys(d.documents || {}).length > 0).length;
    const entriesWithPath = deliveries.filter(d => {
      const docs = d.documents || {};
      return Object.values(docs).some(v => {
        try {
          const arr = typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : [v]);
          return Array.isArray(arr) && arr.some(el => el && el.path);
        } catch (e) {
          return false;
        }
      });
    }).length;

    console.log(`\n📈 Estatísticas:`);
    console.log(`   Entregas com documentos: ${entriesWithDocs}`);
    console.log(`   Entregas com path salvo: ${entriesWithPath}`);
    console.log(`   Taxa de completude: ${((entriesWithPath / entriesWithDocs) * 100).toFixed(2)}%`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
