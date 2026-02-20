#!/usr/bin/env node

/**
 * Script para testar se os campos desovaStartAt e desovaEndAt
 * estão sendo salvos e recuperados corretamente
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api';

// Credenciais de teste
const motorista = {
  email: 'motorista@example.com',
  password: 'senha123'
};

async function test() {
  try {
    console.log('🧪 Testando campos desovaStartAt e desovaEndAt...\n');

    // 1. Login
    console.log('1️⃣  Fazendo login...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, motorista);
    const token = loginRes.data.token;
    console.log('   ✅ Login bem-sucedido');

    const api = axios.create({
      baseURL: BASE_URL,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 2. Buscar uma entrega existente ou criar uma
    console.log('\n2️⃣  Buscando entregas...');
    const deliveriesRes = await api.get('/deliveries');
    const deliveries = deliveriesRes.data.deliveries || [];

    if (deliveries.length === 0) {
      console.log('   ⚠️  Nenhuma entrega encontrada. Criando uma...');
      const createRes = await api.post('/deliveries', {
        deliveryNumber: `TEST-${Date.now()}`,
        vehiclePlate: 'TEST-PLATE',
        observations: 'Teste automático'
      });
      var delivery = createRes.data.delivery;
    } else {
      const delivery = deliveries[0];
    }

    console.log(`   ✅ Entrega selecionada: ${delivery.deliveryNumber}`);

    // 3. Atualizar com desovaStartAt
    console.log('\n3️⃣  Atualizando com desovaStartAt...');
    const now = new Date().toISOString();
    const updateRes = await api.put(`/deliveries/${delivery._id}`, {
      desovaStartAt: now,
      status: 'EM_DESOVA'
    });

    const updated = updateRes.data.delivery;
    console.log(`   ✅ Atualizado! desovaStartAt: ${updated.desovaStartAt}`);

    // 4. Verificar se foi salvo
    console.log('\n4️⃣  Recuperando entrega para verificar...');
    const getRes = await api.get(`/deliveries/${delivery._id}`);
    const retrieved = getRes.data.delivery;

    console.log(`   Campos salvos:`);
    console.log(`     - desovaStartAt: ${retrieved.desovaStartAt}`);
    console.log(`     - status: ${retrieved.status}`);

    if (retrieved.desovaStartAt === now) {
      console.log('\n   ✅ desovaStartAt foi salvo corretamente!');
    } else {
      console.log('\n   ❌ desovaStartAt NÃO foi salvo corretamente!');
      console.log(`      Esperado: ${now}`);
      console.log(`      Obtido: ${retrieved.desovaStartAt}`);
    }

    // 5. Atualizar com desovaEndAt
    console.log('\n5️⃣  Atualizando com desovaEndAt...');
    const endTime = new Date().toISOString();
    const updateRes2 = await api.put(`/deliveries/${delivery._id}`, {
      desovaEndAt: endTime,
      status: 'DESOVA_FINALIZADA'
    });

    const updated2 = updateRes2.data.delivery;
    console.log(`   ✅ Atualizado! desovaEndAt: ${updated2.desovaEndAt}`);

    // 6. Verificar se foi salvo
    console.log('\n6️⃣  Recuperando entrega para verificar...');
    const getRes2 = await api.get(`/deliveries/${delivery._id}`);
    const retrieved2 = getRes2.data.delivery;

    console.log(`   Campos salvos:`);
    console.log(`     - desovaStartAt: ${retrieved2.desovaStartAt}`);
    console.log(`     - desovaEndAt: ${retrieved2.desovaEndAt}`);
    console.log(`     - status: ${retrieved2.status}`);

    if (retrieved2.desovaEndAt === endTime) {
      console.log('\n   ✅ desovaEndAt foi salvo corretamente!');
    } else {
      console.log('\n   ❌ desovaEndAt NÃO foi salvo corretamente!');
    }

    // 7. Verificar na rota admin
    console.log('\n7️⃣  Verificando na rota admin /admin/deliveries...');
    
    // Login como admin
    const adminRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    const adminToken = adminRes.data.token;

    const adminApi = axios.create({
      baseURL: BASE_URL,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const adminDeliviesRes = await adminApi.get('/admin/deliveries');
    const adminDeliv = adminDeliviesRes.data.deliveries.find(d => d.deliveryNumber === delivery.deliveryNumber);

    if (adminDeliv) {
      console.log(`   ✅ Entrega encontrada na view admin`);
      console.log(`     - horarioInicioDesova: ${adminDeliv.horarioInicioDesova}`);
      console.log(`     - horarioFimDesova: ${adminDeliv.horarioFimDesova}`);
      console.log(`     - horarioChegada: ${adminDeliv.horarioChegada}`);

      if (adminDeliv.horarioInicioDesova && adminDeliv.horarioFimDesova) {
        console.log('\n✅ TESTE PASSOU! Os campos estão sendo salvos e exibidos corretamente!');
      } else {
        console.log('\n⚠️  TESTE FALHOU! Os campos não estão sendo mapeados corretamente no admin');
      }
    } else {
      console.log('   ❌ Entrega não encontrada na view admin');
    }

  } catch (err) {
    console.error('❌ Erro durante o teste:', err.message);
    if (err.response) {
      console.error('Resposta:', err.response.data);
    }
    process.exit(1);
  }
}

test();
