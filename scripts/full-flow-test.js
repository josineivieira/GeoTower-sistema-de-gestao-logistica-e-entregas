#!/usr/bin/env node
/**
 * Complete flow test: login → create user → list motoristas → edit motorista
 */

const http = require('http');
const BASE_URL = 'http://localhost:5000';
let token = null;

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body, error: 'JSON parse error' });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('\n========== TESTE COMPLETO FLUXO GERENTE ==========\n');

  try {
    // 1. Login como gerente
    console.log('✏️  STEP 1: Login como gerente');
    let res = await request('POST', '/api/auth/login', {
      username: 'gerente',
      password: 'gerente123'
    });
    
    if (res.status !== 200) {
      console.error(`❌ ERRO: Status ${res.status}`);
      console.error('   Detalhes:', res.body);
      return;
    }

    token = res.body.token;
    const user = res.body.driver;
    console.log(`✅ LOGIN OK - Role: ${user.role}\n`);

    // 2. Create user (sem permissão específica - test)
    console.log('✏️  STEP 2: Criar novo usuário (POST /api/admin/users)');
    const newUser = `user_${Date.now()}`;
    res = await request('POST', '/api/admin/users', {
      username: newUser,
      email: `${newUser}@test.com`,
      name: 'Novo Usuário',
      password: 'senha123',
      role: 'driver'
    }, { Authorization: `Bearer ${token}` });

    if (res.status === 200 || res.status === 201) {
      console.log(`✅ USUÁRIO CRIADO - Status: ${res.status}\n`);
    } else {
      console.error(`❌ ERRO: Status ${res.status}`);
      console.error('   Mensagem:', res.body.message || res.body.error);
      console.error('   Detalhes:', res.body);
      console.log('');
    }

    // 3. List motoristas (sem dados para editar)
    console.log('✏️  STEP 3: Listar motoristas (GET /api/admin/motoristas)');
    res = await request('GET', '/api/admin/motoristas', null, { Authorization: `Bearer ${token}` });

    if (res.status !== 200) {
      console.error(`❌ ERRO: Status ${res.status}`);
      console.error('   Detalhes:', res.body);
      return;
    }

    const motoristas = res.body.motoristas || [];
    console.log(`✅ MOTORISTAS LISTADOS - Quantidade: ${motoristas.length}`);

    if (motoristas.length === 0) {
      console.log('⚠️  Nenhum motorista na base de dados para editar/deletar\n');
      console.log('========== TESTE CONCLUÍDO (SEM MOTORISTAS) ==========\n');
      return;
    }

    // 4. Try to edit first motorista
    const motorista = motoristas[0];
    console.log(`\n✏️  STEP 4: Editar motorista ID: ${motorista._id}`);
    res = await request('PUT', `/api/admin/motoristas/${motorista._id}`, {
      transportadora: motorista.transportadora || 'TEST',
      nome: `Editado_${Date.now()}`,
      cpf: motorista.cpf || '12345678901',
      vinculo: motorista.vinculo || 'PJ',
      telefone: motorista.telefone || '9199999999',
      ativo: true
    }, { Authorization: `Bearer ${token}` });

    if (res.status === 200) {
      console.log(`✅ MOTORISTA EDITADO - Status: ${res.status}\n`);
    } else {
      console.error(`❌ ERRO: Status ${res.status}`);
      console.error('   Mensagem:', res.body.message || res.body.error);
      console.error('   Detalhes:', res.body);
      console.log('');
    }

    // 5. Try to delete motorista
    console.log(`✏️  STEP 5: Deletar motorista ID: ${motorista._id}`);
    res = await request('DELETE', `/api/admin/motoristas/${motorista._id}`, null, { Authorization: `Bearer ${token}` });

    if (res.status === 200) {
      console.log(`✅ MOTORISTA DELETADO - Status: ${res.status}\n`);
    } else {
      console.error(`❌ ERRO: Status ${res.status}`);
      console.error('   Mensagem:', res.body.message || res.body.error);
      console.error('   Detalhes:', res.body);
      console.log('');
    }

    console.log('========== TESTE CONCLUÍDO COM SUCESSO ==========\n');
  } catch (err) {
    console.error('❌ Erro fatal:', err.message);
    console.error(err.stack);
  }
}

test();
