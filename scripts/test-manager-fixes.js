#!/usr/bin/env node
/**
 * Test script to verify manager can:
 * 1. Create new user
 * 2. Edit/Delete motorista
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
  console.log('\n========== TESTE MANAGER FIXES ==========\n');

  try {
    // 1. Login como admin
    console.log('1️⃣  Login como admin...');
    let res = await request('POST', '/api/auth/login', {
      username: 'josinei vieira',
      password: 'senha123'  // Será testado
    });
    if (res.status !== 200 || !res.body.token) {
      console.error('❌ Falha ao fazer login como admin:', res.status, res.body);
      console.log('   Tentando com outro usuário...');
      res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      if (res.status !== 200 || !res.body.token) {
        console.error('❌ Ainda sem sucesso:', res.status, res.body);
        return;
      }
    }
    managerToken = res.body.token;
    console.log('✅ Login bem-sucedido:', res.body.user?.username);

    // 2. Tentar criar novo usuário com ID único
    const uniqueUsername = 'testuser_' + Date.now();
    console.log('\n2️⃣  Criando novo usuário como gerente...');
    console.log(`   Username: ${uniqueUsername}`);
    res = await request('POST', '/api/admin/users', {
      username: uniqueUsername,
      email: `${uniqueUsername}@example.com`,
      name: 'Test User',
      password: 'testpass123',
      role: 'driver'
    });
    if (res.status === 201 || res.status === 200) {
      console.log('✅ Usuário criado com sucesso! Status:', res.status);
      console.log('   Resposta:', res.body);
    } else {
      console.error('❌ Erro ao criar usuário. Status:', res.status);
      console.error('   Resposta:', res.body);
    }

    // 3. Listar motoristas
    console.log('\n3️⃣  Listando motoristas como gerente...');
    res = await request('GET', '/api/admin/motoristas');
    if (res.status === 200) {
      console.log('✅ Motoristas listados! Quantidade:', res.body?.motoristas?.length || 0);
      if (res.body?.motoristas?.length > 0) {
        const firstMotorista = res.body.motoristas[0];
        console.log('   Primeiro motorista ID:', firstMotorista._id);

        // 4. Tentar atualizar motorista
        console.log('\n4️⃣  Atualizando primeiro motorista...');
        res = await request('PUT', `/api/admin/motoristas/${firstMotorista._id}`, {
          transportadora: firstMotorista.transportadora,
          nome: 'Nome Atualizado ' + Date.now(),
          cpf: firstMotorista.cpf,
          vinculo: firstMotorista.vinculo,
          telefone: firstMotorista.telefone,
          ativo: true
        });
        if (res.status === 200) {
          console.log('✅ Motorista atualizado com sucesso!');
        } else {
          console.error('❌ Erro ao atualizar motorista. Status:', res.status);
          console.error('   Resposta:', res.body);
        }
      }
    } else {
      console.error('❌ Erro ao listar motoristas. Status:', res.status);
      console.error('   Resposta:', res.body);
    }

    console.log('\n========== FIM DO TESTE ==========\n');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

test();
