const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const { getUploadsBaseDir } = require('./utils/uploadPaths');

dotenv.config({ path: path.join(__dirname, "../../.env") });

// Garante que os arquivos de credenciais do Google Drive sejam gerados a partir
// das variáveis de ambiente, caso existam. Isso roda mesmo se o comando de
// start do ambiente não usar o script de setup.
try {
  require('./scripts/write-google-creds');
} catch (e) {
  console.warn('[CRED] Aviso: falha ao executar write-google-creds:', e && e.message ? e.message : e);
}

// Initialize mock database (used as fallback if MongoDB not configured)
const mockdb = require('./mockdb');

// ⚠️  DIAGNÓSTICO DE BANCO DE DADOS
const dbMode = process.env.MONGODB_URI ? 'MongoDB' : 'MockDB (Em Memória)';
console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   🗄️  CONFIGURAÇÃO DE BANCO                    ║
╠════════════════════════════════════════════════════════════════╣
║  Modo: ${dbMode.padEnd(57)}║
${process.env.MONGODB_URI ? '' : `║                                                                ║
║  ⚠️  ATENÇÃO: MockDB não persiste após reinicializações!      ║
║  Dados serão perdidos quando o servidor reiniciar.             ║
║                                                                ║
║  Para usar MongoDB em Render:                                 ║
║  1. Vá em Render.com → seu serviço → Environment               ║
║  2. Adicione variável: MONGODB_URI                             ║
║  3. Valor: MONGODB_URI_REMOVED                ║
║  4. Clique em Deploy                                          ║
╚════════════════════════════════════════════════════════════════╝`}
╚════════════════════════════════════════════════════════════════╝
`);

const app = express();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src https://entregascomgeotransportes.onrender.com/static/js/ https://geotower.com.br/static/js/ https://www.geotower.com.br/static/js/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://grupogeobackend.onrender.com https://entregascomgeotransportes.onrender.com https://geotower.com.br https://www.geotower.com.br capacitor://localhost http://localhost https://localhost",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'"
].join('; ');

const defaultCorsOrigins = [
  'https://entregascomgeotransportes.onrender.com',
  'https://geotower.com.br',
  'https://www.geotower.com.br',
  'https://grupogeobackend.onrender.com',
  'http://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:8100',
  'capacitor://localhost',
  'ionic://localhost'
];

const envCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedCorsOrigins = Array.from(new Set([...defaultCorsOrigins, ...envCorsOrigins]));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origem nao permitida pelo CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-City"],
};

// Global error handlers to help diagnose crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('UNHANDLED REJECTION at Promise:', p, 'reason:', reason);
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: false,
}));

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS restrito aos dominios oficiais, localhost e WebViews mobile.
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Debug: log incoming requests (method, path, origin, X-City) to help diagnose connectivity issues
app.use((req, res, next) => {
  try {
    console.log(`⬅️ ${req.method} ${req.originalUrl} - Host: ${req.headers.host} - Origin: ${req.headers.origin} - X-City: ${req.header('x-city')}`);
  } catch (e) {
    // ignore logging errors
  }
  next();
});

// City middleware (define req.city e req.mockdb)
app.use(require('./middleware/city'));

// Validate user city permissions (verifica se o usuário tem acesso à cidade da requisição)
app.use(require('./middleware/validateUserCity'));

// ✅ Serve uploads (para abrir imagens no navegador)
const staticUploadsPath = getUploadsBaseDir();
console.log('✓ Serving uploads from:', staticUploadsPath);
app.use('/uploads', express.static(staticUploadsPath));

// If BACKEND_UPLOADS_DIR is set, try to migrate existing repo uploads into persistent location (first-run)
if (process.env.BACKEND_UPLOADS_DIR) {
  try {
    const repoUploads = path.join(__dirname, '../uploads');
    const persistent = path.resolve(process.env.BACKEND_UPLOADS_DIR);
    if (!fs.existsSync(persistent)) fs.mkdirSync(persistent, { recursive: true });

    const persistentHasFiles = fs.existsSync(persistent) && fs.readdirSync(persistent).length > 0;
    // Only move if persistent is empty and repoUploads has content
    if (!persistentHasFiles && fs.existsSync(repoUploads)) {
      console.log('⤴️ Migrating existing repo uploads to BACKEND_UPLOADS_DIR...');
      const entries = fs.readdirSync(repoUploads);
      for (const e of entries) {
        const src = path.join(repoUploads, e);
        const dest = path.join(persistent, e);
        try {
          fs.renameSync(src, dest);
        } catch (err) {
          console.warn('⚠️ Failed to move', src, '->', dest, ':', err.message);
        }
      }
      // attempt to remove old uploads folder if empty
      try { if (fs.existsSync(repoUploads) && fs.readdirSync(repoUploads).length === 0) fs.rmdirSync(repoUploads); } catch (e) {}
      console.log('✓ Migration of uploads complete');
    }
  } catch (err) {
    console.error('⚠️ Error during uploads migration:', err);
  }
}

// ⚡ QUERY MONITORING - Identificar queries lentas
// ATIVADO: Log queries > 100ms com avisos em tempo real
try {
  const queryMonitor = require('./middleware/queryMonitor');
  app.use(queryMonitor({ threshold: 100, logSlowQueries: true, verbose: false }));
  console.log('✓ Query Monitor ativado (threshold: 100ms)');
} catch (e) {
  console.warn('⚠️ Falha ao inicializar Query Monitor:', e?.message);
}

// Routes - ANTES do frontend catch-all
app.use("/api/auth", require("./routes/auth"));
app.use("/api/deliveries", require("./routes/delivery"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin/reconciliation", require("./routes/reconciliation"));
app.use("/api/gdrive", require("./routes/gdrive-auth-web"));
app.use("/api/notifications", require("./routes/notifications"));
// Meta routes (version/debug)
app.use("/api/meta", require("./routes/meta"));
// Uploads to Cloudflare R2 via S3-compatible API
app.use("/api", require("./routes/uploadR2"));
// Icompany - Maritime Logistics Database
app.use("/api/icompany", require("./routes/icompanyRoutes"));
// Controle de Protocolos - Protocol Management
app.use("/api/controle-protocolos", require("./routes/controleProtocolos"));

// Health check
app.get("/api/health", (req, res) => {
  const { mongoose } = require('./db/mongo');
  res.json({
    success: true,
    message: "Server is running",
    mongo: {
      configured: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI),
      readyState: mongoose.connection.readyState,
      connected: mongoose.connection.readyState === 1,
      dbName: mongoose.connection.name || null,
      host: mongoose.connection.host || null
    }
  });
});

app.get(["/.well-known/security.txt", "/security.txt"], (req, res) => {
  res.type("text/plain").send([
    "Contact: mailto:geotower@geotransportes.com.br",
    "Preferred-Languages: pt-BR, en",
    "Canonical: https://entregascomgeotransportes.onrender.com/.well-known/security.txt",
    ""
  ].join("\n"));
});

// Servir frontend estático (React build)
// Tenta múltiplos caminhos (desenvolvimento vs produção)
let buildPath = null;
const possiblePaths = [
  path.join(__dirname, '../../frontend/build'),     // desenvolvimento local
  path.join(__dirname, '../frontend/build'),        // alternativo
  '/app/frontend/build',                            // Railway deployment
  '/frontend/build',                                // Railway alternativo
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    buildPath = p;
    break;
  }
}

console.log('🔍 Procurando build...');
console.log('  Caminhos testados:', possiblePaths);
console.log('  ✓ Encontrado em:', buildPath || 'NENHUM!');

if (buildPath) {
  console.log('✓ Frontend build encontrado! Servindo de:', buildPath);
  app.use(express.static(buildPath));
  
  // Serve index.html para rotas não encontradas (React Router SPA)
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Frontend não encontrado',
        path: indexPath 
      });
    }
  });
} else {
  console.log('⚠️  Build não encontrado em nenhum local!');
  console.log('🚨 O frontend precisa ser compilado!');
  
  // API ainda funciona mesmo sem frontend
  app.get('*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      message: 'API disponível em /api | Frontend build não encontrado' 
    });
  });
}

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .json({ success: false, message: "Erro no servidor", error: err.message });
});

// Start server (skip MongoDB connection)
const PORT = process.env.PORT || 3000;

// NOTE: Single listen handled by startServer() below to ensure binding to 0.0.0.0 and avoid duplicate listens.

const { connectIfNeeded } = require('./db/mongo');
const { scheduleStartupR2RetryScan } = require('./utils/r2RetryQueue');

async function startServer() {
  try {
    // Attempt to connect if MONGODB_URI is provided (use correct env name)
    if (process.env.MONGODB_URI) {
      try {
        await connectIfNeeded();
        scheduleStartupR2RetryScan();
        console.log('✓ Using MongoDB for persistence');
      } catch (err) {
        console.error('⚠️ Failed to connect to MongoDB:', err.message);
      }
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Servidor rodando na porta ${PORT}`);
      console.log(`✓ API disponível em http://localhost:${PORT}/api`);
      console.log(process.env.MONGODB_URI ? '✓ Usando MongoDB como banco' : '✓ Usando banco de dados em memória (mock)');
      console.log(`\n✓ Credenciais de teste:`);
      console.log(`  • admin / admin123`);
      console.log(`  • motorista1 / driver123`);
      console.log(`  • motorista2 / driver123\n`);
    });
  } catch (error) {
    console.error("✗ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

