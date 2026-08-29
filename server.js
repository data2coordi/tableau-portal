const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(express.json());

// JWT トークン発行 API エンドポイント
app.post('/api/get-tableau-token', (req, res) => {
  const { targetUser } = req.body;

  const payload = {
    iss: process.env.TABLEAU_CLIENT_ID,
    sub: targetUser, // 選択されたユーザーコンテキスト (RLS検証用) [source: 3]
    aud: 'tableau',
    exp: Math.floor(Date.now() / 1000) + (5 * 60),
    jti: uuidv4(),
    scp: ['tableau:views:embed', 'tableau:views:embed_authoring']
  };

  const headers = {
    kid: process.env.TABLEAU_SECRET_ID,
    iss: process.env.TABLEAU_CLIENT_ID,
    alg: 'HS256'
  };

  try {
    const token = jwt.sign(payload, process.env.TABLEAU_SECRET_VALUE, { header: headers });
    res.json({
      token,
      siteName: process.env.TABLEAU_SITE_NAME,
      host: process.env.TABLEAU_POD_URL
    });
  } catch (err) {
    console.error('JWT Generation Error:', err);
    res.status(500).json({ error: 'JWT generation failed' });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Tableau Web Portal running on port ${PORT}`);
});
