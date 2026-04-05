require('dotenv').config();
const { connectIfNeeded } = require('../src/db/mongo');
const Delivery = require('../src/models/Delivery');
const ProgramacaoEntrega = require('../src/models/ProgramacaoEntrega');

async function migrate() {
  try {
    await connectIfNeeded();
    console.log('Iniciando migração de EM_ROTA para A_CAMINHO_DO_CLIENTE...');

    const deliveryResult = await Delivery.updateMany(
      { status: 'EM_ROTA' },
      { status: 'A_CAMINHO_DO_CLIENTE' }
    );

    const progResult = await ProgramacaoEntrega.updateMany(
      { status: 'EM_ROTA' },
      { status: 'A_CAMINHO_DO_CLIENTE' }
    );

    console.log(`Delivery: ${deliveryResult.modifiedCount} registro(s) atualizados.`);
    console.log(`ProgramacaoEntrega: ${progResult.modifiedCount} registro(s) atualizados.`);
    console.log('Migração finalizada.');
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
