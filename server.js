const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ご指定の .env 変数名と紐づけ
const TABLEAU_SERVER_URL = process.env.TABLEAU_POD_URL || 'https://prod-apnortheast-a.online.tableau.com';
const TABLEAU_SITE_NAME = process.env.TABLEAU_SITE_NAME || '';
const CONNECTED_APP_CLIENT_ID = process.env.TABLEAU_CLIENT_ID;
const CONNECTED_APP_SECRET_ID = process.env.TABLEAU_SECRET_ID;
const CONNECTED_APP_SECRET_VALUE = process.env.TABLEAU_SECRET_VALUE;

const TABLEAU_PAT_NAME = process.env.TABLEAU_PAT_NAME;
const TABLEAU_PAT_SECRET = process.env.TABLEAU_PAT_SECRET;

// 1. Connected Apps (JWT) 生成エンドポイント (Option 2: ログイン不要の動的RLS認証)
app.post('/api/get-tableau-token', (req, res) => {
  const targetUser = req.body.targetUser;
  console.log(`\n--- [JWT Gen Request] Target User (sub): ${targetUser} ---`);

  if (!targetUser) {
    return res.status(400).json({ error: 'targetUser is required' });
  }

  if (!CONNECTED_APP_CLIENT_ID || !CONNECTED_APP_SECRET_VALUE) {
    console.error('[JWT Error] Environment variables for Connected App are missing in .env');
    return res.status(500).json({ error: 'Server environment configuration error (TABLEAU_CLIENT_ID / TABLEAU_SECRET_VALUE missing)' });
  }

  // Tableau Embedding API v3 用のJWTペイロード
  const payload = {
    iss: CONNECTED_APP_CLIENT_ID,
    sub: targetUser, // RLSのコンテキストとなるユーザーのメールアドレス
    aud: 'tableau',
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10分間有効
    jti: uuidv4(),
    scp: ['tableau:views:embed', 'tableau:views:embed_authoring']
  };

  const headers = {
    kid: CONNECTED_APP_SECRET_ID,
    alg: 'HS256'
  };

  try {
    const token = jwt.sign(payload, CONNECTED_APP_SECRET_VALUE, { header: headers });
    console.log(`[JWT Success] Successfully generated JWT for user: ${targetUser}`);
    res.json({ token, user: targetUser });
  } catch (err) {
    console.error('[JWT Generation Exception]', err.message);
    res.status(500).json({ error: `JWT Generation Failed: ${err.message}` });
  }
});

// 2. Tableau REST API 経由でダッシュボード一覧を動的に取得するエンドポイント (要件4)
app.post('/api/get-dashboards', async (req, res) => {
  console.log('\n--- [REST API Request] Fetching Views from Tableau Online ---');

  if (!TABLEAU_PAT_NAME || !TABLEAU_PAT_SECRET) {
    console.warn('[REST API Warning] Personal Access Token (PAT) missing in .env. Returning fallback/sample list.');
    return res.json({
      dashboards: [
        { id: '1', name: 'Sales Overview', url: `${TABLEAU_SERVER_URL}/t/${TABLEAU_SITE_NAME}/views/Sample_Sales/Overview` }
      ]
    });
  }

  try {
    // Step A: REST API 認証 (signin)
    const signinUrl = `${TABLEAU_SERVER_URL}/api/3.20/auth/signin`;
    const authRes = await fetch(signinUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        credentials: {
          personalAccessTokenName: TABLEAU_PAT_NAME,
          personalAccessTokenSecret: TABLEAU_PAT_SECRET,
          site: { contentUrl: TABLEAU_SITE_NAME }
        }
      })
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      console.error('[REST API Auth Failed]', JSON.stringify(authData));
      return res.status(authRes.status).json({ error: 'Tableau REST Auth Failed' });
    }

    const restToken = authData.credentials.token;
    const siteId = authData.credentials.site.id;

    // Step B: Query Views API による一覧取得
    const viewsUrl = `${TABLEAU_SERVER_URL}/api/3.20/sites/${siteId}/views`;
    const viewsRes = await fetch(viewsUrl, {
      method: 'GET',
      headers: { 'X-Tableau-Auth': restToken, 'Accept': 'application/json' }
    });

    const viewsData = await viewsRes.json();
    if (!viewsRes.ok) {
      return res.status(viewsRes.status).json({ error: 'Query Views Failed' });
    }

    // Step C: Embedding API 用の URL 構造へ変換
    const rawViews = viewsData.views?.view || [];
    const dashboards = rawViews.map(v => {
      const cleanContentUrl = v.contentUrl.replace('/sheets/', '/');
      const embedUrl = TABLEAU_SITE_NAME
        ? `${TABLEAU_SERVER_URL}/t/${TABLEAU_SITE_NAME}/views/${cleanContentUrl}`
        : `${TABLEAU_SERVER_URL}/views/${cleanContentUrl}`;

      return { id: v.id, name: v.name, url: embedUrl };
    });

    // サインアウト (非同期)
    fetch(`${TABLEAU_SERVER_URL}/api/3.20/auth/signout`, {
      method: 'POST',
      headers: { 'X-Tableau-Auth': restToken }
    }).catch(() => { });

    res.json({ dashboards });

  } catch (error) {
    console.error('[REST API Exception]', error.message);
    res.status(500).json({ error: `Server Exception: ${error.message}` });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Tableau TA Demo Portal Server is running on port ${PORT}`);
  console.log(`Target Tableau Server: ${TABLEAU_SERVER_URL}`);
  console.log(`Target Site ContentUrl: ${TABLEAU_SITE_NAME}`);
  console.log(`==================================================`);
});