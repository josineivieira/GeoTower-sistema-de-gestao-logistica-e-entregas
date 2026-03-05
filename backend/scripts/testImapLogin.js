require("dotenv").config();
const imaps = require("imap-simple");

async function test(host) {
  const cfg = {
    imap: {
      user: process.env.OUTLOOK_EMAIL,
      password: process.env.OUTLOOK_PASSWORD,
      host,
      port: 993,
      tls: true,
      authTimeout: 15000,
      tlsOptions: { servername: host } // ajuda em alguns casos
    }
  };

  try {
    const conn = await imaps.connect(cfg);
    await conn.openBox("INBOX");
    console.log(`✅ LOGIN OK em: ${host}`);
    await conn.end();
    return true;
  } catch (e) {
    console.log(`❌ ${host} -> ${e.message}`);
    return false;
  }
}

(async () => {
  console.log("EMAIL:", process.env.OUTLOOK_EMAIL);
  if (!process.env.OUTLOOK_EMAIL || !process.env.OUTLOOK_PASSWORD) {
    console.log("❌ Falta OUTLOOK_EMAIL/OUTLOOK_PASSWORD no .env");
    process.exit(1);
  }

  // testa os 2 hosts mais comuns
  const ok1 = await test("imap-mail.outlook.com");
  const ok2 = await test("outlook.office365.com");

  if (!ok1 && !ok2) {
    console.log("\n➡️ Se falhou nos dois, é bloqueio/credencial. Veja passos abaixo.");
  }
})();