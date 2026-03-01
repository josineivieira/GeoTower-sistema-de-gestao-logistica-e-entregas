const puppeteer = require('puppeteer');
const path = require('path');
const markdownpdf = require('markdown-pdf');

async function generateRichPDF() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const htmlPath = path.join(__dirname, 'docs', 'USO_DO_APP.html');
    const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
    console.log('Carregando (HTML):', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle2' });
    const pdfPath = path.join(__dirname, 'docs', 'USO_DO_APP.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
      displayHeaderFooter: false
    });
    console.log('✅ PDF (rich) gerado com sucesso em:', pdfPath);
  } catch (error) {
    console.error('❌ Erro ao gerar PDF rich:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

function generatePlainPDF() {
  return new Promise((resolve, reject) => {
    const mdPath = path.join(__dirname, 'USO_DO_APP.md');
    const outPath = path.join(__dirname, 'docs', 'USO_DO_APP_plain.pdf');
    const cssPath = path.join(__dirname, 'docs', 'pdf-style.css');

    console.log('Convertendo Markdown diretamente para PDF (plain)...');
    markdownpdf({
      cssPath: cssPath
    })
      .from(mdPath)
      .to(outPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ PDF (plain) gerado em:', outPath);
          resolve();
        }
      });
  });
}

(async () => {
  await generateRichPDF();
  await generatePlainPDF();
})();
