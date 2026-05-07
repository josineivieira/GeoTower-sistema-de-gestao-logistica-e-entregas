const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const r2 = require('../r2Client');

async function uploadBuffer(buffer, key, contentType) {
  const bucket = process.env.R2_BUCKET;
  const baseUrl = process.env.R2_PUBLIC_URL;
  const timeoutMs = Number(process.env.R2_UPLOAD_TIMEOUT_MS || 12000);
  
  if (!bucket || !baseUrl) {
    throw new Error('R2_BUCKET or R2_PUBLIC_URL not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    }), { abortSignal: controller.signal });
    
    // Return public URL
    return `${baseUrl}/${key}`;
  } catch (err) {
    console.error('Error uploading to R2:', err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function deleteKey(key) {
  const bucket = process.env.R2_BUCKET;
  
  if (!bucket) {
    throw new Error('R2_BUCKET not configured');
  }

  try {
    await r2.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  } catch (err) {
    console.error('Error deleting from R2:', err);
    throw err;
  }
}

module.exports = { uploadBuffer, deleteKey };
