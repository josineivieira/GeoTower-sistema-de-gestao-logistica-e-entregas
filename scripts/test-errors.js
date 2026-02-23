#!/usr/bin/env node
/**
 * Test to identify the 2 main errors:
 * 1. User creation issue
 * 2. Motorista edit/delete issue
 */

const http = require('http');
const BASE_URL = 'http://localhost:5000';
let managerToken = null;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(managerToken ? { Authorization: `Bearer ${managerToken}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('\n========== DIAGNÓSTICO DE ERROS ==========\n');

  try {
    // 1. Login como manager
    console.log('1️⃣  LOGIN como "gerente" (manager)...');
    let res = await request('POST', '/api/auth/login', {
      username: 'gerente',
      password: 'gerente123'
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Token: ${res.body.token ? '✅ obtido' : '❌ não obtido'}`);
    console.log(`   User role: ${res.body.user?.role}`);
    if (res.status !== 200 || !res.body.token) {
      console.error('❌ ERRO 1: Falha ao fazer login como manager');
      return;
    }
    managerToken = res.body.token;
    console.log('✅ Login OK\n');

    // 2. Criar usuário
    const newUsername = 'newmgr_' + Date.now();
    console.log('2️⃣  CRIAR novo usuário (POST /api/admin/users)...');
    console.log(`   Username: ${newUsername}`);
    res = await request('POST', '/api/admin/users', {
      username: newUsername,
      email: `${newUsername}@test.com`,
      name: 'Novo Usuario Manager',
      password: 'pass123pass',
      role: 'manager'
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Message: ${res.body.message || res.body.error || 'N/A'}`);
    if (res.status !== 200 && res.status !== 201) {
      console.error('❌ ERRO 2: Falha ao criar usuário');
      console.error('   Resposta:', JSON.stringify(res.body, null, 2));
    } else {
      console.log('✅ Usuário criado OK\n');
    }

    // 3. Listar motoristas
    console.log('3️⃣  LISTAR motoristas (GET /api/admin/motoristas)...');
    res = await request('GET', '/api/admin/motoristas?limit=1');
    console.log(`   Status: ${res.status}`);
    console.log(`   Quantidade: ${res.body?.motoristas?.length || 0}`);
    console.log(`   Message: ${res.body.message || 'N/A'}`);
    if (res.body?.motoristas?.length > 0) {
      const id = res.body.motoristas[0]._id;
      
      // 4. Editar motorista
      console.log(`\n4️⃣  EDITAR motorista (PUT /api/admin/motoristas/${id})...`);
      res = await request('PUT', `/api/admin/motoristas/${id}`, {
        transportadora: 'GEO TRANSPORTES',
        nome: 'Nome Editado ' + Date.now(),
        cpf: '12345678901',
        vinculo: 'PJ',
        telefone: '9199999999',
        ativo: true
      });
      console.log(`   Status: ${res.status}`);
      console.log(`   Message: ${res.body.message || res.body.error || 'N/A'}`);
      if (res.status !== 200) {
        console.error('❌ ERRO 3: Falha ao editar motorista');
        console.error('   Resposta:', JSON.stringify(res.body, null, 2));
      } else {
        console.log('✅ Motorista editado OK\n');
      }

      // 5. Deletar motorista
      console.log(`5️⃣  DELETAR motorista (DELETE /api/admin/motoristas/${id})...`);
      res = await request('DELETE', `/api/admin/motoristas/${id}`);
      console.log(`   Status: ${res.status}`);
      console.log(`   Message: ${res.body.message || res.body.error || 'N/A'}`);
      if (res.status !== 200) {
        console.error('❌ ERRO 4: Falha ao deletar motorista');
        console.error('   Resposta:', JSON.stringify(res.body, null, 2));
      } else {
        console.log('✅ Motorista deletado OK\n');
      }
    } else {
      console.log('⚠️  Nenhum motorista para editar/deletar');
    }

    console.log('\n========== FIM DO DIAGNÓSTICO ==========\n');
  } catch (err) {
    console.error('❌ Erro fatal:', err.message);
    console.error(err.stack);
  }
}

test();
