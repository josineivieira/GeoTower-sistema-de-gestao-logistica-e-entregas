const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Tenta múltiplos caminhos possíveis para os arquivos de credenciais
let CREDENTIALS_PATH = path.join(__dirname, '../../google-credentials.json');
let TOKEN_PATH = path.join(__dirname, '../../google-token.json');

// Se não encontrar, tenta em mais locais
const possibleCredentialsPaths = [
  CREDENTIALS_PATH,  // backend/google-credentials.json (quando __dirname é backend/src/storage)
  path.join(__dirname, '../../backend/google-credentials.json'),  // relativo à raiz
  path.join(process.cwd(), 'backend/google-credentials.json'),  // CWD + backend
  path.join(process.cwd(), 'google-credentials.json'),  // CWD direto
  '/app/backend/google-credentials.json',  // Render container
  '/app/google-credentials.json'  // Render root
];

const possibleTokenPaths = [
  TOKEN_PATH,
  path.join(__dirname, '../../backend/google-token.json'),
  path.join(process.cwd(), 'backend/google-token.json'),
  path.join(process.cwd(), 'google-token.json'),
  '/app/backend/google-token.json',
  '/app/google-token.json'
];

// Encontra o primeiro caminho que existe
function findPath(possiblePaths, description) {
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[GDRIVE] ✓ ${description} encontrado em: ${p}`);
      return p;
    }
  }
  console.warn(`[GDRIVE] ⚠️  ${description} não encontrado em nenhum dos caminhos tentados`);
  return possiblePaths[0];  // retorna o primeiro como fallback
}

CREDENTIALS_PATH = findPath(possibleCredentialsPaths, 'google-credentials.json');
TOKEN_PATH = findPath(possibleTokenPaths, 'google-token.json');

function getOAuth2Client() {
  try {
    // Verifica se os arquivos existem
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.warn(`[GDRIVE] ⚠️  Arquivo de credenciais não encontrado: ${CREDENTIALS_PATH}`);
      console.warn(`[GDRIVE] ⚠️  Google Drive está DESATIVADO - usando apenas armazenamento local`);
      return null;
      return null;
    }
    
    if (!fs.existsSync(TOKEN_PATH)) {
      console.warn(`[GDRIVE] ⚠️  Arquivo de token não encontrado: ${TOKEN_PATH}`);
      console.warn(`[GDRIVE] ⚠️  Google Drive está DESATIVADO - usando apenas armazenamento local`);
      return null;
    }

    console.log('[GDRIVE] Carregando credenciais de:', CREDENTIALS_PATH);
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    
    // Accept both 'installed' (desktop) and 'web' (web app) credential formats
    const credRoot = credentials.installed || credentials.web;
    if (!credRoot) {
      console.warn('[GDRIVE] ⚠️  Estrutura de credenciais inválida');
      return null;
    }

    const { client_secret, client_id, redirect_uris } = credRoot;
    
    if (!client_id || !client_secret || !redirect_uris) {
      console.warn('[GDRIVE] ⚠️  Credenciais incompletas');
      return null;
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
  if (!oAuth2Client) {
    console.warn('[GDRIVE] OAuth2Client é null - credenciais não disponíveis');
    return false;
  }
  try {
    // This will trigger a refresh if needed and emit 'tokens' event
    await oAuth2Client.getAccessToken();
    return true;
  } catch (err) {
    console.error('[GDRIVE] Falha ao atualizar access token:', err && err.message ? err.message : err);
    throw err;
  }
}

// Criar ou encontrar pasta de entrega
async function createOrFindDeliveryFolder(deliveryNumber) {
  try {
    const auth = getOAuth2Client();
    if (!auth) {
      console.warn('[GDRIVE] Google Drive não configurado - usando armazenamento local');
      throw new Error('Google Drive não configurado');
    }
    
    const freshOk = await ensureFreshCredentials(auth);
    if (!freshOk) {
      throw new Error('Não foi possível garantir credenciais válidas');
    }
    
    const parentFolderId = process.env.GDRIVE_FOLDER_ID;
    
    if (!parentFolderId) {
      throw new Error('GDRIVE_FOLDER_ID não está definido nas variáveis de ambiente');
    }

    const drive = google.drive({ version: 'v3', auth });
    const folderName = `${deliveryNumber}`;
    
    // Procurar por pasta existente com esse nome
    console.log(`[GDRIVE] Procurando pasta: ${folderName} dentro de ${parentFolderId}`);
    const searchRes = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
      pageSize: 1,
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      const existingFolder = searchRes.data.files[0];
      console.log(`[GDRIVE] ✓ Pasta encontrada: ${existingFolder.name} (ID: ${existingFolder.id})`);
      return existingFolder.id;
    }

    // Se não encontrou, criar nova pasta
    console.log(`[GDRIVE] Pasta não encontrada. Criando nova pasta: ${folderName}`);
    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });

    console.log(`[GDRIVE] ✓ Nova pasta criada: ${folderName} (ID: ${createRes.data.id})`);
    return createRes.data.id;
  } catch (err) {
    console.error('[GDRIVE] ✗ Erro ao criar/encontrar pasta:', err.message);
    throw err;
  }
}

async function uploadFileToDrive(buffer, filename, mimetype, parentFolderId = null) {
  try {
    const auth = getOAuth2Client();
    if (!auth) {
      console.warn('[GDRIVE] Google Drive não configurado - usando armazenamento local');
      throw new Error('Google Drive não configurado');
    }
    
    // Garantir que temos um access token válido antes de tentar o upload
    try { 
      const freshOk = await ensureFreshCredentials(auth);
      if (!freshOk) {
        throw new Error('Não foi possível garantir credenciais válidas');
      }
    } catch (e) { 
      console.error('[GDRIVE] Erro ao garantir credenciais:', e.message);
      throw e;
    }
    
    // Se não foi passado parentFolderId, usar a pasta padrão
    let folderId = parentFolderId || process.env.GDRIVE_FOLDER_ID;
    
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

module.exports = { uploadFileToDrive, createOrFindDeliveryFolder };

module.exports.getOAuth2Client = getOAuth2Client;
module.exports.ensureFreshCredentials = ensureFreshCredentials;
