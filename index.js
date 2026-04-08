const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const ZAPI_INSTANCE = '3F158C331D8A326B611D2295B0810B48';
const ZAPI_TOKEN = '8FB78AC69420CCDE31F20255';
const ZAPI_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;

let conversations = {};

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => res.json({ status: 'VLV WhatsApp Server Online' }));

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (!body.phone) return res.sendStatus(200);
    const phone = body.phone.replace(/\D/g, '');
    const message = body.text?.message || body.message || '';
    const fromMe = body.fromMe || false;
    const senderName = body.senderName || 'Lead';
    const timestamp = new Date().toLocaleString('pt-BR');
    if (!conversations[phone]) conversations[phone] = { phone, name: senderName, messages: [] };
    if (message) conversations[phone].messages.push({ text: message, fromMe, time: timestamp, senderName });
    console.log(`Msg de ${phone}: ${message}`);
    res.sendStatus(200);
  } catch (e) {
    console.error('Erro webhook:', e);
    res.sendStatus(500);
  }
});

app.get('/conversa/:phone', (req, res) => {
  const phone = req.params.phone.replace(/\D/g, '');
  res.json(conversations[phone] || { phone, messages: [] });
});

app.get('/conversas', (req, res) => res.json(Object.values(conversations)));

app.post('/enviar', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone e message obrigatorios' });
    const phoneClean = phone.replace(/\D/g, '');
    const response = await axios.post(`${ZAPI_URL}/send-text`, { phone: phoneClean, message });
    const timestamp = new Date().toLocaleString('pt-BR');
    if (!conversations[phoneClean]) conversations[phoneClean] = { phone: phoneClean, messages: [] };
    conversations[phoneClean].messages.push({ text: message, fromMe: true, time: timestamp, senderName: 'Consultor' });
    res.json({ success: true, data: response.data });
  } catch (e) {
    console.error('Erro enviar:', e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VLV Server rodando na porta ${PORT}`));
