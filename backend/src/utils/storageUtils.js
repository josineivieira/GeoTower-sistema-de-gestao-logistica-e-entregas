const fs = require('fs');
const path = require('path');
const s3 = process.env.S3_BUCKET ? require('../storage/s3') : null;

function normalizeEntries(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  if (typeof entry === 'string') {
    // legacy: comma-separated string
    if (entry.indexOf(',') !== -1) return entry.split(',').map(s => s.trim()).filter(Boolean);
    return [entry];
  }
  return [];
}

async function deleteDeliveryFiles(delivery) {
  const docs = delivery.documents || {};
  const city = delivery.city || 'manaus';
  const removed = [];

  for (const [type, entry] of Object.entries(docs)) {
    if (!entry) continue;
    const entries = normalizeEntries(entry);
    for (const rel of entries) {
      if (!rel) continue;
      if (typeof rel === 'string' && rel.startsWith && rel.startsWith('http') && s3) {
        try {
          const url = new URL(rel);
          const key = url.pathname.replace(/^\//, '');
          await s3.deleteKey(key);
          removed.push(rel);
        } catch (err) {
          console.warn('Failed to delete S3 key for', rel, err.message || err);
        }
      } else {
        // Try BACKEND_UPLOADS_DIR first
        const base = process.env.BACKEND_UPLOADS_DIR ? path.resolve(process.env.BACKEND_UPLOADS_DIR) : path.join(__dirname, '..', 'uploads');
        const candidate1 = path.join(base, city, rel);
        const candidate2 = path.join(base, rel);
        try {
          if (fs.existsSync(candidate1)) { fs.unlinkSync(candidate1); removed.push(candidate1); }
          else if (fs.existsSync(candidate2)) { fs.unlinkSync(candidate2); removed.push(candidate2); }
        } catch (err) {
          console.warn('Failed to unlink file', rel, err.message || err);
        }
      }
    }
  }

  return removed;
}

function normalizeDeliveryForResponse(delivery) {
  if (!delivery) return delivery;
  const d = JSON.parse(JSON.stringify(delivery));
  d.documents = d.documents || {};
  for (const [k, v] of Object.entries(d.documents)) {
    if (!v) { d.documents[k] = null; continue; }
    if (Array.isArray(v)) {
      // Normalize array elements which may be JSON strings or double-encoded
      const out = [];
      for (const el of v) {
        if (!el && el !== 0) continue;
        if (typeof el === 'string') {
          let parsed = el;
          for (let i = 0; i < 5; i++) {
            if (typeof parsed !== 'string') break;
            try { parsed = JSON.parse(parsed); } catch (e) { break; }
          }
          if (Array.isArray(parsed)) {
            for (const sub of parsed) {
              if (typeof sub === 'string') {
                try { out.push(JSON.parse(sub)); } catch (e) { out.push(sub); }
              } else out.push(sub);
            }
          } else if (parsed && typeof parsed === 'object') {
            out.push(parsed);
          } else {
            out.push(parsed);
          }
        } else {
          out.push(el);
        }
      }
      d.documents[k] = out;
      continue;
    }
    if (typeof v === 'string') {
      // Try to robustly parse JSON strings, including nested/double-encoded JSON.
      try {
        let parsed = v;
        // attempt repeated JSON.parse if the value is nested-encoded
        for (let i = 0; i < 5; i++) {
          if (typeof parsed !== 'string') break;
          try {
            parsed = JSON.parse(parsed);
          } catch (err) {
            break;
          }
        }

        if (Array.isArray(parsed)) {
          // If array elements are themselves JSON strings, parse them
          d.documents[k] = parsed.map((el) => {
            if (typeof el === 'string') {
              try {
                return JSON.parse(el);
              } catch (e) {
                return el;
              }
            }
            return el;
          });
        } else if (parsed && typeof parsed === 'object') {
          d.documents[k] = [parsed];
        } else {
          // Fallback: comma-separated or single string entry
          if (v.indexOf(',') !== -1) d.documents[k] = v.split(',').map(s => s.trim()).filter(Boolean);
          else d.documents[k] = [v];
        }
      } catch (e) {
        if (v.indexOf(',') !== -1) d.documents[k] = v.split(',').map(s => s.trim()).filter(Boolean);
        else d.documents[k] = [v];
      }
    }
  }
  return d;
}

module.exports = {
  deleteDeliveryFiles,
  normalizeEntries,
  normalizeDeliveryForResponse
};