const fs = require('fs');
const path = require('path');
const htmlDocx = require('html-docx-js');

async function generateDocx() {
  const htmlPath = path.join(__dirname, 'docs', 'USO_DO_APP.html');
  const docxPath = path.join(__dirname, 'docs', 'USO_DO_APP.docx');
  
  console.log('Lendo HTML em', htmlPath);
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // html-docx-js precisa de um HTML básico; adicionar DOCTYPE
  const fullHtml = '<!DOCTYPE html>' + html;
  const blob = htmlDocx.asBlob(fullHtml);
  
  // Convert Blob to Buffer for Node filesystem
  const arrayBuffer = await blob.arrayBuffer();
  const docxBuffer = Buffer.from(arrayBuffer);
  
  fs.writeFileSync(docxPath, docxBuffer);
  console.log('✅ Documento Word gerado em', docxPath);
}

// Execute
(async () => {
  await generateDocx();
})();
