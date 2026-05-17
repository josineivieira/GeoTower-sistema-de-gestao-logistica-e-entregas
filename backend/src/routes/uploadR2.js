const express = require("express");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const r2 = require("../r2Client");
const auth = require("../middleware/auth");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });

    const bucket = process.env.R2_BUCKET;
    const baseUrl = process.env.R2_PUBLIC_URL;

    const safeName = req.file.originalname.replace(/[^\w.\-]+/g, "_");
    const key = `uploads/${Date.now()}-${safeName}`;

    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const url = `${baseUrl}/${key}`;
    return res.json({ ok: true, url, key });
  } catch (e) {
    console.error("R2 upload erro:", e);
    return res.status(500).json({ error: "Falha no upload R2", detail: String(e?.message || e) });
  }
});

module.exports = router;
