const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

function readGitHead() {
  try {
    const gitDir = path.join(__dirname, '..', '..', '.git');
    const headPath = path.join(gitDir, 'HEAD');
    if (!fs.existsSync(headPath)) return null;
    const head = fs.readFileSync(headPath, 'utf8').trim();
    if (head.startsWith('ref:')) {
      const ref = head.split(':')[1].trim();
      const refPath = path.join(gitDir, ref);
      if (fs.existsSync(refPath)) {
        return fs.readFileSync(refPath, 'utf8').trim();
      }
    }
    // HEAD contains commit
    return head;
  } catch (err) {
    return null;
  }
}

function getCommitInfo() {
  // Try common env vars set by hosting platforms
  const candidates = [
    process.env.GIT_COMMIT,
    process.env.RENDER_GIT_COMMIT,
    process.env.RENDER_COMMIT,
    process.env.COMMIT_SHA,
    process.env.HEROKU_SLUG_COMMIT,
    process.env.SOURCE_COMMIT
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return { commit: String(c).trim(), source: 'env' };
  }

  const gitHead = readGitHead();
  if (gitHead) return { commit: gitHead, source: '.git' };

  return { commit: null, source: 'unknown' };
}

router.get('/version', (req, res) => {
  try {
    const info = getCommitInfo();
    const payload = {
      success: true,
      commit: info.commit,
      commitSource: info.source,
      nodeEnv: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
    console.log('[META] /api/meta/version ->', payload);
    return res.json(payload);
  } catch (err) {
    console.error('[META] Erro ao retornar versão', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Erro ao obter versão' });
  }
});

module.exports = router;
