#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Iniciando build do frontend...');

try {
  // Build
  execSync('cd frontend && npm run build', { 
    stdio: 'inherit',
    timeout: 180000 // 3 minutos
  });
  
  // Verificar
  const indexPath = path.join(__dirname, 'frontend', 'build', 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log('\n✅ BUILD CONCLUÍDO COM SUCESSO!');
    const stats = fs.statSync(indexPath);
    console.log(`   index.html: ${(stats.size / 1024).toFixed(2)}KB`);
  } else {
    console.log('\n❌ Erro: index.html não encontrado após build');
  }
} catch (e) {
  console.error('\n❌ Erro no build:', e.message);
  process.exit(1);
}
