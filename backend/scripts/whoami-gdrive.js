const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

console.log('[whoami-gdrive] script starting');

async function main() {
  try {
    const CREDENTIALS_PATH = path.join(__dirname, '..', 'google-credentials.json');
    const TOKEN_PATH = path.join(__dirname, '..', 'google-token.json');

    if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
      throw new Error('Arquivos de credenciais ou token não encontrados em backend/');
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const credRoot = credentials.installed || credentials.web;
    if (!credRoot) throw new Error('Estrutura de credenciais inválida');

    const { client_id, client_secret, redirect_uris } = credRoot;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const res = await drive.about.get({ fields: 'user' });

    console.log('\n🔎 Conta autenticada:');
    console.log(`  - Display name: ${res.data.user.displayName}`);
    console.log(`  - Email: ${res.data.user.emailAddress}`);
    console.log(`  - Permission ID: ${res.data.user.permissionId}\n`);
  } catch (err) {
    console.error('Erro ao obter conta autenticada:', err.message);
    process.exit(1);
  }
}

main();
