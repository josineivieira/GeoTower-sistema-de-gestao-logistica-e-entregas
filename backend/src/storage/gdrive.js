const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Carrega as credenciais do Google (você precisará gerar um arquivo credentials.json no Google Cloud Console)
const CREDENTIALS_PATH = path.join(__dirname, '../../google-credentials.json');
const TOKEN_PATH = path.join(__dirname, '../../google-token.json');

function getOAuth2Client() {
  try {
    // Verifica se os arquivos existem
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`Arquivo de credenciais não encontrado: ${CREDENTIALS_PATH}`);
    }
    
    if (!fs.existsSync(TOKEN_PATH)) {
      throw new Error(`Arquivo de token não encontrado: ${TOKEN_PATH}`);
    }

    console.log('[GDRIVE] Carregando credenciais de:', CREDENTIALS_PATH);
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    
    // Accept both 'installed' (desktop) and 'web' (web app) credential formats
    const credRoot = credentials.installed || credentials.web;
    if (!credRoot) {
      throw new Error('Estrutura de credenciais inválida: missing "installed" or "web" property');
    }

    const { client_secret, client_id, redirect_uris } = credRoot;
    
    if (!client_id || !client_secret || !redirect_uris) {
      throw new Error('Credenciais incompletas: faltam client_id, client_secret ou redirect_uris');
    }

    console.log('[GDRIVE] Credenciais carregadas com sucesso');
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      console.log('[GDRIVE] Token carregado e configurado');
      oAuth2Client.setCredentials(token);
    }
    // Quando o client obtiver/atualizar tokens (refresh automático), persista no disco
    oAuth2Client.on && oAuth2Client.on('tokens', (tokens) => {
      try {
        let existing = {};
        if (fs.existsSync(TOKEN_PATH)) {
          existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) || {};
        }
        const merged = Object.assign({}, existing, tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged));
        console.log('[GDRIVE] Tokens atualizados e salvos em', TOKEN_PATH);
      } catch (e) {
        console.error('[GDRIVE] Falha ao salvar tokens:', e.message);
      }
    });

    return oAuth2Client;
  } catch (err) {
    console.error('[GDRIVE] Erro ao carregar OAuth2Client:', err.message);
    throw err;
  }
}

async function ensureFreshCredentials(oAuth2Client) {
  try {
    // This will trigger a refresh if needed and emit 'tokens' event
    await oAuth2Client.getAccessToken();
    return true;
  } catch (err) {
    console.error('[GDRIVE] Falha ao atualizar access token:', err && err.message ? err.message : err);
    throw err;
  }
}

async function uploadFileToDrive(buffer, filename, mimetype) {
  try {
    const auth = getOAuth2Client();
    // Garantir que temos um access token válido antes de tentar o upload
    try { await ensureFreshCredentials(auth); } catch (e) { /* continue to let upload fail with clear error */ }
    const folderId = process.env.GDRIVE_FOLDER_ID;
    
    if (!folderId) {
      throw new Error('GDRIVE_FOLDER_ID não está definido nas variáveis de ambiente');
    }

    console.log(`[GDRIVE] Iniciando upload de ${filename} para pasta ${folderId}`);
    
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: mimetype,
        body: Readable.from(buffer instanceof Buffer ? buffer : Buffer.from(buffer)),
      },
      fields: 'id,webViewLink,webContentLink',
    });
    
    console.log(`[GDRIVE] ✓ Arquivo ${filename} enviado com sucesso. ID: ${res.data.id}`);
    return res.data;
  } catch (err) {
    console.error('[GDRIVE] ✗ Erro ao fazer upload:', err.message);
    throw err;
  }
}

module.exports = { uploadFileToDrive };

module.exports.getOAuth2Client = getOAuth2Client;
module.exports.ensureFreshCredentials = ensureFreshCredentials;
