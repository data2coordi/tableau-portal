const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(express.json());

app.post('/api/get-tableau-token', (req, res) => {
  const { targetUser } = req.body;
  const user = targetUser || 'data2coordi@gmail.com';

  // 1. サーバー側で実際に読み込んでいる .env の値をログ出力 [source: 2]
  console.log('=== [DEBUG ENV PRINT] ===');
  console.log('CLIENT_ID   :', process.env.TABLEAU_CLIENT_ID);
  console.log('SECRET_ID   :', process.env.TABLEAU_SECRET_ID);
  console.log('SECRET_VALUE:', process.env.TABLEAU_SECRET_VALUE);
  console.log('SITE_NAME   :', process.env.TABLEAU_SITE_NAME);
  console.log('POD_URL     :', process.env.TABLEAU_POD_URL);
  console.log('=========================');

  const payload = {
    iss: process.env.TABLEAU_CLIENT_ID,
    sub: user, // ユーザーコンテキストをセットして動的 RLS を評価 [source: 4]
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

    // 2. フロントエンドにも読み込まれているキー情報を返却して可視化 [source: 2]
    res.json({
      token,
      siteName: process.env.TABLEAU_SITE_NAME,
      host: process.env.TABLEAU_POD_URL,
      envDebug: {
        clientId: process.env.TABLEAU_CLIENT_ID,
        secretId: process.env.TABLEAU_SECRET_ID,
        secretValue: process.env.TABLEAU_SECRET_VALUE,
        siteName: process.env.TABLEAU_SITE_NAME,
        podUrl: process.env.TABLEAU_POD_URL
      }
    });
  } catch (err) {
    console.error('[JWT ERROR]', err);
    res.status(500).json({ error: 'JWT generation failed', details: err.message });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));