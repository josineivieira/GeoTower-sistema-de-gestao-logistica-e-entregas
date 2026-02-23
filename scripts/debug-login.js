#!/usr/bin/env node
/**
 * Debug test to check what backend returns on login
 */

const http = require('http');
const BASE_URL = 'http://localhost:5000';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve({ error: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('\n========== DEBUG: Login Response ==========\n');

  try {
    // Test 1: Login as gerente (manager)
    console.log('1️⃣  Login como "gerente"...');
    let res = await request('POST', '/api/auth/login', {
      username: 'gerente',
      password: 'gerente123'
    });
    console.log('Response:', JSON.stringify(res, null, 2));

    console.log('\n2️⃣  Login como "admin"...');
    res = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('Response:', JSON.stringify(res, null, 2));

    console.log('\n========== END DEBUG ==========\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
