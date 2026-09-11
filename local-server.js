// Isolated preview: never imports production handlers or cloud credentials.
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, '.local');
mkdirSync(dataDir, { recursive: true });
const dataPath = path.join(dataDir, 'preview-data.json');
const permissions = Object.fromEntries([
  'canGenerateImages', 'canGenerateVideos', 'canSearchClients', 'canAccessTenders',
  'canAccessSales', 'canAccessAnalytics', 'canAccessCalculation', 'canAccessConveyor',
  'canAccessKnowledge', 'canAccessDeepResearch', 'canAccessPsychologist', 'canAccessSandbox'
].map(key => [key, true]));
permissions.sandboxApps = ['consilium'];
const demoUser = { id: 'local-demo', username: 'demo', email: 'demo@localhost',
  firstName: 'Локальный', lastName: 'Администратор', role: 'ADMIN', isBlocked: false,
  permissions, city: 'SPB' };
const data = existsSync(dataPath) ? JSON.parse(readFileSync(dataPath, 'utf8')) : {};
data.users = { ...data.users, [demoUser.id]: demoUser };
data.settings ??= { global: { prompts: {}, welcomeMessages: {}, quickPrompts: [] } };
const save = () => writeFileSync(dataPath, JSON.stringify(data, null, 2));
save();
const app = express();
app.use(compression());
app.use(express.json({ limit: '50mb' }));
// Reject cross-origin browser requests to this local preview.
app.use('/api', (req, res, next) => {
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
    return res.status(403).json({ error: 'Local requests only' });
  }
  next();
});
app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'local-preview', integrations: false }));
app.post('/api/db', (req, res) => {
  const { action, collectionName, docId, ...payload } = req.body || {};
  if (action === 'login') {
    return payload.username === 'demo' && payload.password === 'demo'
      ? res.json(demoUser) : res.status(401).json({ error: 'Use demo / demo for local preview' });
  }
  if (action === 'get_settings') return res.json(data.settings.global);
  if (action === 'save_settings') { data.settings.global = { ...data.settings.global, ...payload.settings }; save(); return res.json({ success: true }); }
  if (['list_known_leads', 'list_personal_ignores', 'get_unread_notifications'].includes(action)) return res.json([]);
  if (action === 'track_analytics') return res.json({ success: true, mode: 'local-preview' });
  if (!['list', 'get', 'set', 'delete'].includes(action)) return res.status(501).json({ error: 'Эта операция недоступна в локальном просмотре.' });
  if (typeof collectionName !== 'string' || collectionName.split('/').some(p => ['__proto__', 'constructor', 'prototype'].includes(p)) || ['__proto__', 'constructor', 'prototype'].includes(docId)) return res.status(400).json({ error: 'Invalid collection or document' });
  const collection = data[collectionName] ??= {};
  if (action === 'list') return res.json(Object.entries(collection).map(([id, value]) => ({ ...value, id })));
  if (action === 'get') return res.json(collection[docId] ?? null);
  if (!docId) return res.status(400).json({ error: 'Document ID required' });
  if (action === 'set') collection[docId] = { ...collection[docId], ...payload.data };
  if (action === 'delete') delete collection[docId];
  save();
  return res.json({ success: true, id: docId });
});
app.use('/api', (req, res) => res.status(503).json({ error: 'Локальный просмотр: облачные сервисы не подключены. Нужны доступы из HANDOVER.md.' }));
app.use(express.static(path.join(root, 'dist-local')));
app.get('*', (req, res) => res.sendFile(path.join(root, 'dist-local', 'index.html')));
app.listen(3000, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:3000 | demo / demo'));
