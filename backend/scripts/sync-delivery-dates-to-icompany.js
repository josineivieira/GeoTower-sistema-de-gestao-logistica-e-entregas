require('dotenv').config();
const mongoose = require('mongoose');
const Delivery = require('../src/models/Delivery');
const Icompany = require('../src/models/Icompany');
const { connectIfNeeded } = require('../src/db/mongo');

async function syncDeliveryDatesToIcompany() {
  try {
    await connectIfNeeded();
    console.log('🔄 Iniciando sincronização de datas de entregas para Icompany...');

    // Buscar todas as entregas
    const deliveries = await Delivery.find({}).lean();
    console.log(`📦 Encontradas ${deliveries.length} entregas`);

    let updatedCount = 0;

    for (const delivery of deliveries) {
      const deliveryNumber = delivery.deliveryNumber;
      if (!deliveryNumber) continue;

      // Tentar encontrar Icompany por linkedIcompanyId ou por campos
      let icompanyRecord = null;

      if (delivery.linkedIcompanyId) {
        icompanyRecord = await Icompany.findById(delivery.linkedIcompanyId);
      }

      if (!icompanyRecord) {
        // Buscar por campos, normalizando
        const normalizedDeliveryNum = deliveryNumber.trim().toUpperCase();
        icompanyRecord = await Icompany.findOne({
          $or: [
            { geomaritima: new RegExp(`^${normalizedDeliveryNum}$`, 'i') },
            { numero: new RegExp(`^${normalizedDeliveryNum}$`, 'i') },
            { containerNumero: new RegExp(`^${normalizedDeliveryNum}$`, 'i') },
            { processo: new RegExp(`^${normalizedDeliveryNum}$`, 'i') },
            { codigo: new RegExp(`^${normalizedDeliveryNum}$`, 'i') },
            { geomaritima: normalizedDeliveryNum },
            { numero: normalizedDeliveryNum },
            { containerNumero: normalizedDeliveryNum },
            { processo: normalizedDeliveryNum },
            { codigo: normalizedDeliveryNum },
            // Também tentar sem normalizar
            { geomaritima: deliveryNumber },
            { numero: deliveryNumber },
            { containerNumero: deliveryNumber },
            { processo: deliveryNumber },
            { codigo: deliveryNumber }
          ]
        });
      }

      if (!icompanyRecord) {
        console.log(`❌ Icompany não encontrado para entrega: ${deliveryNumber}`);
        continue;
      }

      // Atualizar linkedIcompanyId na entrega se não estiver setado
      if (!delivery.linkedIcompanyId) {
        await Delivery.findByIdAndUpdate(delivery._id, { linkedIcompanyId: icompanyRecord._id });
        console.log(`✅ Linked Icompany ID setado para entrega ${deliveryNumber}`);
      }

      const updates = {};

      // Mapear datas da entrega para Icompany
      if ((delivery.status === 'A_CAMINHO_DO_CLIENTE' || delivery.status === 'EM_DESOVA' || delivery.status === 'AGUARDANDO_ANEXO' || delivery.status === 'ANEXANDO_DOCUMENTOS_FINAIS' || delivery.status === 'EM_ROTA' || delivery.status === 'ENTREGUE' || delivery.status === 'FINALIZADO') && !icompanyRecord.dtInicioRota) {
        // Para dtInicioRota, usar quando iniciou a rota, aproximar com createdAt se não tiver arrivedAt
        updates.dtInicioRota = delivery.arrivedAt || delivery.createdAt;
      }

      if (delivery.desovaStartAt && !icompanyRecord.dtInicioDescarga) {
        updates.dtInicioDescarga = delivery.desovaStartAt;
      }

      if (delivery.desovaEndAt && !icompanyRecord.dtFimDescarga) {
        updates.dtFimDescarga = delivery.desovaEndAt;
      }

      if (delivery.containerMontadoAt && !icompanyRecord.dtRetiraPD) {
        updates.dtRetiraPD = delivery.containerMontadoAt;
      }

      if (delivery.horarioDevolucaoVazio && !icompanyRecord.dtDevolucaoCNTR) {
        updates.dtDevolucaoCNTR = delivery.horarioDevolucaoVazio;
      }

      // Verificar observations para CONTAINER_VAZIO_DEVOLVIDO
      if (delivery.observations && delivery.observations.includes('(CONTAINER_VAZIO_DEVOLVIDO)') && !icompanyRecord.dtDevolucaoCNTR) {
        updates.dtDevolucaoCNTR = delivery.updatedAt; // Usar updatedAt como aproximado
      }

      if (Object.keys(updates).length > 0) {
        await Icompany.findByIdAndUpdate(icompanyRecord._id, updates);
        console.log(`✅ Atualizado Icompany ${icompanyRecord.codigo}:`, Object.keys(updates));
        updatedCount++;
      }
    }

    console.log(`🎉 Sincronização concluída! ${updatedCount} registros Icompany atualizados.`);
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  } finally {
    mongoose.connection.close();
  }
}

syncDeliveryDatesToIcompany();