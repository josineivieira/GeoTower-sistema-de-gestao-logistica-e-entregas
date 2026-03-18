const http = require('http');

console.log('Testando endpoint /api/ycompany/compare...\n');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/ycompany/compare',
  method: 'GET',
  timeout: 5000
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ SUCESSO! Endpoint funcionando:\n');
      console.log(`Total de registros: ${json.data.length}\n`);
      
      // Mostrar primeiros 2 registros
      json.data.slice(0, 2).forEach(rec => {
        console.log(`📦 Processo: ${rec.processo}`);
        Object.entries(rec.analysis).forEach(([col, comp]) => {
          const geo = comp.geoTower === 'V' ? '✅' : '❌';
          const ico = comp.icompany === 'V' ? '✅' : '❌';
          console.log(`   ${col}: GEO TOWER=${geo} | iCOMPANY=${ico}`);
        });
        console.log('');
      });
      
    } catch (e) {
      console.log('❌ Erro ao processar JSON:', e.message);
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição:', error.message);
});

req.on('timeout', () => {
  console.error('❌ Timeout na requisição');
  req.destroy();
});

req.end();
