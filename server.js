import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection pool
const { Pool } = pg;
export const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'postgres',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
});

// Test DB connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Could not connect to local PostgreSQL:');
    console.error(`   Host: ${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'}`);
    console.error(`   Database: ${process.env.PG_DATABASE || 'postgres'}`);
    console.error(`   User: ${process.env.PG_USER || 'postgres'}`);
    console.error(`   Error message: ${err.message}`);
    console.error('\n👉 Please make sure PG_PASSWORD in .env matches your local PostgreSQL password.');
  } else {
    release();
    console.log('✅ Connected to local PostgreSQL database successfully!');
  }
});

// Helper: Run setup_database.sql
app.post('/api/setup-database', async (req, res) => {
  try {
    const sqlPath = path.join(__dirname, 'supabase', 'setup_database.sql');
    if (!fs.existsSync(sqlPath)) {
      return res.status(404).json({ error: 'setup_database.sql not found' });
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    res.json({ success: true, message: 'Database schema created & seed data inserted successfully!' });
  } catch (err) {
    console.error('Setup database error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT current_database(), current_user, version()');
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    res.json({
      status: 'connected',
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      version: result.rows[0].version,
      publicTables: tables.rows.map((r) => r.table_name),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- Auth compatibility endpoints ---
app.post('/auth/v1/token', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM public.profiles WHERE lower(email) = lower($1) LIMIT 1', [email || 'admin@aivsupport.com']);
    let user = userRes.rows[0];

    if (!user) {
      const demoEmail = email || 'admin@aivsupport.com';
      const isStaff = demoEmail.includes('admin') || demoEmail.includes('manager') || demoEmail.includes('agent');
      user = {
        id: '00000000-0000-0000-0000-000000000a01',
        auth_uid: '00000000-0000-0000-0000-000000000a01',
        email: demoEmail,
        first_name: isStaff ? 'System' : 'Demo',
        last_name: isStaff ? 'Administrator' : 'User',
        user_type: demoEmail.includes('admin') ? 'admin' : demoEmail.includes('agent') ? 'agent' : 'customer_user',
        status: 'active',
      };
    }

    const authId = user.auth_uid || user.id;

    const authUser = {
      id: authId,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      phone: user.phone || '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
      },
      identities: [],
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const session = {
      access_token: 'local-jwt-token',
      token_type: 'bearer',
      expires_in: 86400,
      refresh_token: 'local-refresh-token',
      user: authUser,
    };

    return res.status(200).json(session);
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/auth/v1/user', async (req, res) => {
  res.json({
    id: '00000000-0000-0000-0000-000000000a01',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@aivsupport.com',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { first_name: 'System', last_name: 'Administrator', user_type: 'admin' },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

app.post('/auth/v1/logout', (req, res) => {
  res.status(200).json({});
});

// --- PostgREST Compatibility Layer for Supabase-js Client ---

// Parser helper for PostgREST query parameters
function parseFilters(query) {
  const whereClauses = [];
  const params = [];
  let paramIdx = 1;

  for (const [key, rawVal] of Object.entries(query)) {
    if (['select', 'order', 'limit', 'offset', 'head'].includes(key)) continue;

    const val = String(rawVal);
    if (val.startsWith('eq.')) {
      whereClauses.push(`"${key}" = $${paramIdx++}`);
      params.push(val.slice(3));
    } else if (val.startsWith('neq.')) {
      whereClauses.push(`"${key}" != $${paramIdx++}`);
      params.push(val.slice(4));
    } else if (val.startsWith('in.(') && val.endsWith(')')) {
      const items = val.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
      whereClauses.push(`"${key}" = ANY($${paramIdx++})`);
      params.push(items);
    } else if (val.startsWith('not.in.(') && val.endsWith(')')) {
      const items = val.slice(8, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
      whereClauses.push(`NOT ("${key}" = ANY($${paramIdx++}))`);
      params.push(items);
    } else if (val.startsWith('is.')) {
      const item = val.slice(3);
      if (item === 'null') {
        whereClauses.push(`"${key}" IS NULL`);
      } else if (item === 'true') {
        whereClauses.push(`"${key}" IS TRUE`);
      } else if (item === 'false') {
        whereClauses.push(`"${key}" IS FALSE`);
      }
    }
  }

  return {
    where: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params,
  };
}

// GET /rest/v1/:table
app.get('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  const isHead = req.headers['prefer']?.includes('count=exact') || req.query.head === 'true';

  try {
    const { where, params } = parseFilters(req.query);

    // If head / count request
    if (isHead) {
      const countSql = `SELECT count(*)::int as count FROM public."${table}" ${where}`;
      const countRes = await pool.query(countSql, params);
      const total = countRes.rows[0]?.count || 0;
      res.setHeader('content-range', `0-${total}/${total}`);
      return res.status(200).json([]);
    }

    let orderBy = '';
    if (req.query.order) {
      const parts = String(req.query.order).split('.');
      const col = parts[0];
      const dir = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      orderBy = `ORDER BY "${col}" ${dir}`;
    }

    let limitClause = '';
    if (req.query.limit) {
      limitClause = `LIMIT ${parseInt(String(req.query.limit), 10)}`;
    }

    // Standard SELECT query
    const sql = `SELECT * FROM public."${table}" ${where} ${orderBy} ${limitClause}`;
    const result = await pool.query(sql, params);

    // Enrich tickets with foreign relations if requested
    if (table === 'tickets' && String(req.query.select || '').includes('(')) {
      const enrichedRows = await Promise.all(
        result.rows.map(async (ticket) => {
          const [accRes, creatorRes, agentRes, teamRes, typeRes, catRes] = await Promise.all([
            ticket.account_id ? pool.query('SELECT id, company_name, account_code FROM public.accounts WHERE id = $1', [ticket.account_id]) : { rows: [] },
            ticket.created_by_user_id ? pool.query('SELECT id, first_name, last_name, email FROM public.profiles WHERE id = $1', [ticket.created_by_user_id]) : { rows: [] },
            ticket.assigned_agent_id ? pool.query('SELECT id, first_name, last_name, email FROM public.profiles WHERE id = $1', [ticket.assigned_agent_id]) : { rows: [] },
            ticket.assigned_team_id ? pool.query('SELECT id, name FROM public.support_teams WHERE id = $1', [ticket.assigned_team_id]) : { rows: [] },
            ticket.ticket_type_id ? pool.query('SELECT id, name FROM public.ticket_types WHERE id = $1', [ticket.ticket_type_id]) : { rows: [] },
            ticket.category_id ? pool.query('SELECT id, name FROM public.ticket_categories WHERE id = $1', [ticket.category_id]) : { rows: [] },
          ]);

          return {
            ...ticket,
            accounts: accRes.rows[0] || null,
            created_by_user: creatorRes.rows[0] || null,
            assigned_agent: agentRes.rows[0] || null,
            assigned_team: teamRes.rows[0] || null,
            ticket_types: typeRes.rows[0] || null,
            ticket_categories: catRes.rows[0] || null,
          };
        })
      );

      res.setHeader('content-range', `0-${enrichedRows.length}/${enrichedRows.length}`);
      return res.json(enrichedRows);
    }

    // Enrich messages with author if requested
    if (table === 'ticket_messages' && String(req.query.select || '').includes('author')) {
      const enrichedMessages = await Promise.all(
        result.rows.map(async (msg) => {
          const authorRes = msg.author_user_id ? await pool.query('SELECT id, first_name, last_name, email, user_type FROM public.profiles WHERE id = $1', [msg.author_user_id]) : { rows: [] };
          return {
            ...msg,
            author: authorRes.rows[0] || null,
          };
        })
      );
      return res.json(enrichedMessages);
    }

    const wantsSingle = req.headers['accept']?.includes('vnd.pgrst.object+json');
    if (wantsSingle) {
      return res.json(result.rows[0] || null);
    }

    res.setHeader('content-range', `0-${result.rows.length}/${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error(`GET /rest/v1/${table} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /rest/v1/:table
app.post('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  const payload = req.body;

  try {
    const records = Array.isArray(payload) ? payload : [payload];
    const insertedRows = [];

    for (const record of records) {
      // Auto-generate ticket_number if inserting into tickets
      if (table === 'tickets' && !record.ticket_number) {
        const nextNum = Math.floor(100000 + Math.random() * 900000);
        record.ticket_number = `AIV-${nextNum}`;
      }

      const keys = Object.keys(record);
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map((k) => record[k]);

      const sql = `INSERT INTO public."${table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
      const result = await pool.query(sql, values);
      insertedRows.push(result.rows[0]);
    }

    // Supabase single() returns single object if not array
    if (!Array.isArray(payload)) {
      return res.status(201).json(insertedRows[0]);
    }
    res.status(201).json(insertedRows);
  } catch (err) {
    console.error(`POST /rest/v1/${table} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /rest/v1/:table
app.patch('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  const payload = req.body;

  try {
    const keys = Object.keys(payload);
    if (keys.length === 0) return res.json([]);

    const setClauses = [];
    const values = [];
    let paramIdx = 1;

    for (const key of keys) {
      setClauses.push(`"${key}" = $${paramIdx++}`);
      values.push(payload[key]);
    }

    const { where, params: whereParams } = parseFilters(req.query);
    // Shift where param indices
    const adjustedWhere = where.replace(/\$(\d+)/g, (_, num) => `$${parseInt(num, 10) + values.length}`);
    const allParams = [...values, ...whereParams];

    const sql = `UPDATE public."${table}" SET ${setClauses.join(', ')} ${adjustedWhere} RETURNING *`;
    const result = await pool.query(sql, allParams);
    res.json(result.rows);
  } catch (err) {
    console.error(`PATCH /rest/v1/${table} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /rest/v1/:table
app.delete('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const { where, params } = parseFilters(req.query);
    const sql = `DELETE FROM public."${table}" ${where} RETURNING *`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(`DELETE /rest/v1/${table} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`\n🚀 Local PostgreSQL API bridge running on http://localhost:${PORT}`);
  console.log(`📡 Point VITE_SUPABASE_URL=http://localhost:${PORT} in your .env\n`);
});
