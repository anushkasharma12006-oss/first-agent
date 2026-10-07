import http from 'node:http';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import Groq from 'groq-sdk';
import bcrypt from 'bcryptjs';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_DIR = path.resolve(process.cwd(), 'frontend');

function env(name, fallback = '') {
  return process.env[name] ?? fallback;
}

const dbConfig = {
  host: env('DB_HOST'),
  port: Number(env('DB_PORT', 3306)),
  user: env('DB_USER'),
  password: env('DB_PASSWORD'),
  database: env('DB_NAME', 'first_agent'),
  waitForConnections: true,
  connectionLimit: Number(env('DB_CONNECTION_LIMIT', 5)),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: env('DB_SSL', 'false') === 'true' ? {} : undefined,
};

let pool;
let groq;

function getDb() {
  if (!pool) {
    if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
      throw new Error('Database environment variables are not configured.');
    }
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

function getGroq() {
  if (!groq) {
    const key = env('GROQ_API_KEY');
    if (!key) throw new Error('GROQ_API_KEY is not configured.');
    groq = new Groq({ apiKey: key });
  }
  return groq;
}

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function json(res, status, body) {
  res.writeHead(status, {
    ...baseHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { ...baseHeaders, Location: location });
  res.end();
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Request body is too large.');
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

function cleanString(value, field, max = 120) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field} is too long.`);
  return result;
}

function cleanEmail(value) {
  const email = cleanString(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  return email;
}

function cleanAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) throw new Error('Amount must be a valid positive number.');
  return Math.round(amount * 100) / 100;
}

function cleanUserId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid user ID is required.');
  return id;
}

async function getUserById(userId) {
  const [rows] = await getDb().execute('SELECT id, name, email FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
}

async function getFinanceSummary(userId) {
  const db = getDb();
  const [[expenseRow]] = await db.execute('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?', [userId]);
  const [[incomeRow]] = await db.execute('SELECT COALESCE(SUM(amount), 0) AS total FROM income WHERE user_id = ?', [userId]);
  const totalExpense = Number(expenseRow.total || 0);
  const totalIncome = Number(incomeRow.total || 0);
  return { totalExpense, totalIncome, balance: totalIncome - totalExpense };
}

async function addExpense({ name, amount, category }, userId) {
  await getDb().execute(
    'INSERT INTO expenses (user_id, name, amount, category) VALUES (?, ?, ?, ?)',
    [userId, cleanString(name, 'Expense name'), cleanAmount(amount), typeof category === 'string' && category.trim() ? category.trim().slice(0, 80) : 'Other']
  );
  return 'Expense added successfully.';
}

async function addIncome({ name, amount }, userId) {
  await getDb().execute(
    'INSERT INTO income (user_id, source, amount) VALUES (?, ?, ?)',
    [userId, cleanString(name, 'Income source'), cleanAmount(amount)]
  );
  return 'Income added successfully.';
}

async function askAi(question, userId) {
  const db = getDb();
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found. Please log in again.');

  const [expenses] = await db.execute(
    'SELECT name, amount, category, created_at FROM expenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  const [income] = await db.execute(
    'SELECT source, amount, created_at FROM income WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  const summary = await getFinanceSummary(userId);

  const tools = [
    {
      type: 'function',
      function: {
        name: 'addExpense',
        description: 'Add a new expense to the user account.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Expense name.' },
            amount: { type: 'number', description: 'Expense amount in INR.' },
            category: { type: 'string', description: 'Expense category.' },
          },
          required: ['name', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'addIncome',
        description: 'Add a new income entry to the user account.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Income source.' },
            amount: { type: 'number', description: 'Income amount in INR.' },
          },
          required: ['name', 'amount'],
        },
      },
    },
    {
      type: 'function',
      function: { name: 'getMoneyBalance', description: 'Get the current income minus expenses.', parameters: { type: 'object', properties: {} } },
    },
    {
      type: 'function',
      function: { name: 'getTotalExpense', description: 'Get the user total expenses.', parameters: { type: 'object', properties: {} } },
    },
  ];

  const system = `You are Josh, a friendly personal finance assistant. Use INR and keep answers simple and practical.\n\nUser financial data:\nExpenses: ${JSON.stringify(expenses)}\nIncome: ${JSON.stringify(income)}\nTotal expenses: ${summary.totalExpense} INR\nTotal income: ${summary.totalIncome} INR\nCurrent balance: ${summary.balance} INR`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: cleanString(question, 'Question', 2000) },
  ];

  let completion = await getGroq().chat.completions.create({
    model: env('GROQ_MODEL', 'openai/gpt-oss-120b'),
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.2,
  });

  const message = completion.choices?.[0]?.message;
  if (!message) throw new Error('AI returned an empty response.');

  if (message.tool_calls?.length) {
    messages.push(message);
    for (const toolCall of message.tool_calls) {
      let args;
      try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { args = {}; }
      let result;
      if (toolCall.function.name === 'addExpense') result = await addExpense(args, userId);
      else if (toolCall.function.name === 'addIncome') result = await addIncome(args, userId);
      else if (toolCall.function.name === 'getMoneyBalance') result = `${(await getFinanceSummary(userId)).balance} INR`;
      else if (toolCall.function.name === 'getTotalExpense') result = `${(await getFinanceSummary(userId)).totalExpense} INR`;
      else result = 'Unknown tool.';
      messages.push({ role: 'tool', content: result, tool_call_id: toolCall.id });
    }

    completion = await getGroq().chat.completions.create({
      model: env('GROQ_MODEL', 'openai/gpt-oss-120b'),
      messages,
      tools,
      temperature: 0.2,
    });
  }

  return completion.choices?.[0]?.message?.content || 'I could not generate a response.';
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function serveStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '') relative = '/login.html';
  const requested = path.resolve(FRONTEND_DIR, `.${relative}`);
  if (!requested.startsWith(FRONTEND_DIR + path.sep) && requested !== FRONTEND_DIR) return json(res, 403, { message: 'Forbidden.' });
  try {
    const data = await readFile(requested);
    const type = mimeTypes[path.extname(requested).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { ...baseHeaders, 'Content-Type': type });
    res.end(data);
  } catch {
    return json(res, 404, { message: 'Page not found.' });
  }
}

export async function handler(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rawPathname = requestUrl.pathname;
  const pathname = rawPathname.startsWith('/api/') ? rawPathname.slice(4) : rawPathname;

  if (req.method === 'GET' && pathname === '/health') {
    let database = 'not configured';
    try { await getDb().query('SELECT 1'); database = 'connected'; } catch { database = 'unavailable'; }
    return json(res, database === 'connected' ? 200 : 503, { ok: database === 'connected', database });
  }


  try {
    if (req.method === 'POST' && pathname === '/register') {
      const body = await readJson(req);
      const name = cleanString(body.name, 'Name', 100);
      const email = cleanEmail(body.email);
      const password = cleanString(body.password, 'Password', 200);
      if (password.length < 6) return json(res, 400, { message: 'Password must be at least 6 characters.' });
      const db = getDb();
      const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length) return json(res, 409, { message: 'Email already registered!' });
      const hash = await bcrypt.hash(password, 10);
      const [result] = await db.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
      return json(res, 201, { message: 'Account created successfully!', user: { id: result.insertId, name, email } });
    }

    if (req.method === 'POST' && pathname === '/login') {
      const body = await readJson(req);
      const email = cleanEmail(body.email);
      const password = cleanString(body.password, 'Password', 200);
      const [users] = await getDb().execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
      if (!users.length || !(await bcrypt.compare(password, users[0].password_hash))) return json(res, 401, { message: 'Invalid email or password!' });
      const user = users[0];
      return json(res, 200, { message: 'Login successful!', user: { id: user.id, name: user.name, email: user.email } });
    }

    if (req.method === 'POST' && pathname === '/expenses') {
      const body = await readJson(req);
      const userId = cleanUserId(body.user_id ?? body.userId);
      if (!(await getUserById(userId))) return json(res, 404, { message: 'User not found.' });
      await addExpense(body, userId);
      return json(res, 201, { message: 'Expense added successfully!' });
    }

    if (req.method === 'GET' && pathname === '/expenses') {
      const userId = cleanUserId(requestUrl.searchParams.get('userId'));
      const [expenses] = await getDb().execute('SELECT id, name, amount, category, created_at FROM expenses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return json(res, 200, expenses);
    }

    if (req.method === 'GET' && pathname === '/income') {
      const userId = cleanUserId(requestUrl.searchParams.get('userId'));
      const [income] = await getDb().execute('SELECT id, source, amount, created_at FROM income WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return json(res, 200, income);
    }

    if (req.method === 'GET' && pathname === '/summary') {
      const userId = cleanUserId(requestUrl.searchParams.get('userId'));
      return json(res, 200, await getFinanceSummary(userId));
    }

    if (req.method === 'POST' && pathname === '/ask-ai') {
      const body = await readJson(req);
      const userId = cleanUserId(body.userId);
      const answer = await askAi(body.question, userId);
      return json(res, 200, { answer });
    }

    if (pathname === '/logout') return redirect(res, '/login.html');

    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(`[${req.method} ${pathname}]`, error);
    const status = /required|valid|too long|Invalid JSON|too large/i.test(error.message) ? 400 : 500;
    return json(res, status, { message: status === 400 ? error.message : 'Server error. Please try again.' });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const server = http.createServer(handler);
  server.listen(PORT, HOST, () => console.log(`First-Agent running on port ${PORT}`));
}
