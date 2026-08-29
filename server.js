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

  // 【デバッグ出力】サーバー側の .env 読み込み状況を可視化
  console.log('=== [DEBUG] LOADED .ENV VALUES ===');
  console.log('CLIENT_ID   :', process.env.TABLEAU_CLIENT_ID);
  console.log('SECRET_ID   :', process.env.TABLEAU_SECRET_ID);
  console.log('SECRET_VALUE:', process.env.TABLEAU_SECRET_VALUE);
  console.log('SITE_NAME   :', process.env.TABLEAU_SITE_NAME);
  console.log('POD_URL     :', process.env.TABLEAU_POD_URL);
  console.log('==================================');

  const payload = {
    iss: process.env.TABLEAU_CLIENT_ID,
    sub: user, // ドロップダウンで選択されたユーザーコンテキスト (RLS評価用)[cite: 4]
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

    // 画面側のデバッグパネルにも読み込まれているキー情報を開示して返却
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
app.listen(PORT, () => console.log(`Debug Server running on port ${PORT}`));