/*
Migration script: migrates maritime data from 'programacaoentregas' collection to 'ycompany' collection.
Usage: node scripts/migrate-geomar-to-ycompany.js --dry-run
*/
const { MongoClient } = require('mongodb');
const Ycompany = require('../src/models/Ycompany');
const { connectIfNeeded } = require('../src/db/mongo');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('Migration started', { dryRun });

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI or MONGO_URI not provided. Aborting.');
    process.exit(1);
  }

  // Ensure MONGODB_URI is set for connectIfNeeded()
  if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  }

  await connectIfNeeded();

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();

  const sourceCollection = db.collection('programacaoentregas');
  const totalRecords = await sourceCollection.countDocuments();
  console.log(`Total records in programacaoentregas: ${totalRecords}`);

  // Find records that have maritime-related fields (indicating they are GeoMar operations)
  const maritimeRecords = await sourceCollection.find({
    $or: [
      { 'N° GeoMaritima': { $exists: true, $ne: null, $ne: '' } },
      { 'Nº GeoMaritima': { $exists: true, $ne: null, $ne: '' } },
      { navio: { $exists: true, $ne: null, $ne: '' } },
      { armador: { $exists: true, $ne: null, $ne: '' } },
      { booking: { $exists: true, $ne: null, $ne: '' } },
      { container: { $exists: true, $ne: null, $ne: '' } }
    ]
  }).toArray();

  console.log(`Found ${maritimeRecords.length} maritime records to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of maritimeRecords) {
    try {
      // Map fields from programacaoentregas to ycompany schema
      const ycompanyData = {
        codigo: record['Código'] || record['codigo'] || `AUTO_${Date.now()}_${migrated}`,
        geomaritima: record['N° GeoMaritima'] || record['Nº GeoMaritima'] || record.geomaritima,
        dtInicio: record['Dt. início'] ? new Date(record['Dt. início']) : new Date(),
        situacao: record['Situação'] || record.situacao || 'AGENDADO',
        cliente: record['Cliente'] || record.cliente,
        remetente: record['Remetente'] || record.remetente,
        destinatario: record['Destinatário'] || record.destinatario,
        contratado: record['Contratado'] || record.contratado,
        tipo: record['Tipo'] || record.tipo,
        dtSM: record['Dt. SM'] ? new Date(record['Dt. SM']) : null,
        motorista: record['Motorista'] || record.motorista,
        tracao: record['Tração'] || record.tracao,
        reboque: record['Reboque'] || record.reboque,
        origem: record['Origem'] || record.origem,
        ufColeta: record['UF coleta'] || record.ufColeta,
        pagamento: record['Pagamento'] || record.pagamento,
        tagPedagio: record['TAG Pedágio'] || record.tagPedagio,
        vlFreteProcesso: record['Vl. frete processo'] ? parseFloat(record['Vl. frete processo']) : null,
        vlPedagio: record['Vl. pedágio'] ? parseFloat(record['Vl. pedágio']) : null,
        vlFreteLista: record['Vl. frete lista'] ? parseFloat(record['Vl. frete lista']) : null,
        vlAbastecimento: record['Vl. abastecimento'] ? parseFloat(record['Vl. abastecimento']) : null,
        dtAgendamentoDescarga: record['Dt. agendamento descarga'] ? new Date(record['Dt. agendamento descarga']) : null,
        dtChegada: record['Dt. chegada'] ? new Date(record['Dt. chegada']) : null,
        dtInicioDescarga: record['Dt.Início Descarga'] ? new Date(record['Dt.Início Descarga']) : null,
        hrInicioDescarga: record['Hr.Inicio Descarga'] || record.hrInicioDescarga,
        dtDescidaCNTRCarga: record['Dt. descida CNTR/Carga'] ? new Date(record['Dt. descida CNTR/Carga']) : null,
        dtRetiraPD: record['Dt. retirada P.D.'] ? new Date(record['Dt. retirada P.D.']) : null,
        dtFimDescarga: record['Dt. fim descarga'] ? new Date(record['Dt. fim descarga']) : null,
        dtDevolucaoCNTR: record['Dt. devolução CNTR'] ? new Date(record['Dt. devolução CNTR']) : null,
        terminal: record['Terminal'] || record.terminal,
        destino: record['Destino'] || record.destino,
        ufEntrega: record['UF entrega'] || record.ufEntrega,
        estabCTeNFSe: record['Estab. CT-e/NFS-e'] || record.estabCTeNFSe,
        numCTeNFSe: record['N° CT-e/NFS-e'] || record.numCTeNFSe,
        numAverbacaoCTE: record['N° averbação CTE'] || record.numAverbacaoCTE,
        numCIOT: record['N° CIOT'] || record.numCIOT,
        situacaoCIOT: record['Situação CIOT'] || record.situacaoCIOT,
        numMDFE: record['N° MDFE'] || record.numMDFE,
        situacaoMDFE: record['Situação MDFE'] || record.situacaoMDFE,
        dtAverbacaoMDFE: record['Dt. averbação MDFE'] ? new Date(record['Dt. averbação MDFE']) : null,
        numBooking: record['N° boooking'] || record['N° booking'] || record.numBooking,
        numBookingAgendamento: record['N° boooking agendamento'] || record.numBookingAgendamento,
        armador: record['Armador'] || record.armador,
        navio: record['Navio'] || record.navio,
        numero: record['Número'] || record.numero,
        tara: record['Tara'] || record.tara,
        lacre: record['Lacre'] || record.lacre,
        payload: record['Payload'] || record.payload,
        temperatura: record['Temperatura (C°)'] ? parseFloat(record['Temperatura (C°)']) : null,
        umidade: record['Umidade (%)'] ? parseFloat(record['Umidade (%)']) : null,
        ventilacao: record['Ventilação (Cbm)'] || record.ventilacao,
        pesoBruto: record['Peso bruto'] ? parseFloat(record['Peso bruto']) : null,
        motoristaPulmao: record['Motorista pulmão'] || record.motoristaPulmao,
        motoristaRetro: record['Motorista retro'] || record.motoristaRetro,
        estab: record['Estab.'] || record.estab,
        city: record.city || 'default',
        createdBy: 'migration_script'
      };

      // Check if this record already exists in ycompany
      const existing = await Ycompany.findOne({ codigo: ycompanyData.codigo });
      if (existing) {
        console.log(`Skipping existing record: ${ycompanyData.codigo}`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`Would migrate: ${ycompanyData.codigo} - ${ycompanyData.cliente}`);
      } else {
        await Ycompany.create(ycompanyData);
        console.log(`Migrated: ${ycompanyData.codigo}`);
      }

      migrated++;

    } catch (error) {
      console.error(`Error migrating record:`, error.message);
      errors++;
    }
  }

  console.log('\nMigration Summary:');
  console.log(`Total maritime records found: ${maritimeRecords.length}`);
  console.log(`Successfully migrated: ${migrated}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Errors: ${errors}`);

  await client.close();
  process.exit(0);
}

main().catch(console.error);