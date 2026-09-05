const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 3000;

function resolveGoogleClientId() {
  if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;

  const credentialFiles = fs.readdirSync(__dirname)
    .filter((name) => /^client_secret_.*\.json$/i.test(name));
  if (credentialFiles.length !== 1) return undefined;

  try {
    const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, credentialFiles[0]), 'utf8'));
    return credentials.web?.client_id || credentials.installed?.client_id;
  } catch {
    return undefined;
  }
}

const clientId = resolveGoogleClientId();
const appName = process.env.APP_NAME || 'YouTube Meta Exporter';
const appOperator = process.env.APP_OPERATOR || '';
const contactEmail = process.env.CONTACT_EMAIL || '';

app.disable('x-powered-by');
app.use((request, response, next) => {
  if (request.path === '/.env' || request.path.startsWith('/node_modules/') || request.path.startsWith('/client_secret_')) {
    return response.sendStatus(404);
  }
  next();
});
app.use(express.static(path.join(__dirname)));

// OAuth Client ID is intentionally public: Google requires it in browser code.
// Never add GOOGLE_CLIENT_SECRET to this endpoint or to the frontend.
app.get('/api/config', (_request, response) => {
  if (!clientId) return response.status(503).json({ error: 'GOOGLE_CLIENT_ID is not configured on the server.' });
  response.set('Cache-Control', 'no-store').json({
    googleClientId: clientId,
    appName,
    appOperator,
    contactEmail
  });
});

app.listen(port, () => console.log(`YouTube Meta Exporter is running at http://localhost:${port}`));
