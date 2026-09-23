import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8095;

// SMTP transporter for authentication verification emails
const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'send.one.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'hello@aivhub.com',
    pass: process.env.SMTP_PASS || 'A!vHub@01$',
  },
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection pool
const { Pool } = pg;
export const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'aiv_support',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
});

// Test DB connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Could not connect to local PostgreSQL:');
    console.error(`   Host: ${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '8094'}`);
    console.error(`   Database: ${process.env.PG_DATABASE || 'postgres'}`);
    console.error(`   User: ${process.env.PG_USER || 'postgres'}`);
    console.error(`   Error message: ${err.message}`);
    console.error('\n👉 Please make sure PG_PASSWORD in .env matches your local PostgreSQL password.');
  } else {
    release();
    console.log('✅ Connected to local PostgreSQL database successfully!');
  }
});

// Helper: Run database schema setup
app.post('/api/setup-database', async (req, res) => {
  try {
    const sqlPath = path.join(__dirname, 'backend', 'schema.sql');
    if (!fs.existsSync(sqlPath)) {
      return res.status(404).json({ error: 'backend/schema.sql not found' });
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

// In-memory verification codes store with 10-minute expiry
const pendingVerifications = new Map();

// Helper: Ensure verification codes and profile columns exist in PostgreSQL
async function ensureVerificationTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.email_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        password_hash VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Ensure all required columns exist on profiles table
    await pool.query(`
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_uid VARCHAR(255);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unique_external_id VARCHAR(255);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_handle VARCHAR(255);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_platform VARCHAR(50);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language VARCHAR(50);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS about TEXT;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS other_phone VARCHAR(50);
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS other_phone_type VARCHAR(50);
    `);
    console.log('✅ PostgreSQL schema verified (profiles & verification codes ready)');
  } catch (e) {
    console.warn('Verification table warning:', e.message);
  }
}
ensureVerificationTable();

// 1. Request Sign Up Verification Code (Freshdesk Style)
app.post('/auth/v1/signup', async (req, res) => {
  const { email, password, data: userData } = req.body;
  const firstName = userData?.first_name || '';
  const lastName = userData?.last_name || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Check if account already exists
    const existing = await pool.query('SELECT id FROM public.profiles WHERE lower(email) = lower($1) LIMIT 1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Generate 6-digit verification code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store pending verification in PostgreSQL
    await pool.query('DELETE FROM public.email_verification_codes WHERE lower(email) = lower($1)', [cleanEmail]);
    await pool.query(
      `INSERT INTO public.email_verification_codes (email, code, first_name, last_name, password_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cleanEmail, verificationCode, firstName, lastName, password, expiresAt]
    );

    // Also cache in memory for instant lookups
    pendingVerifications.set(cleanEmail, {
      code: verificationCode,
      firstName,
      lastName,
      password,
      expiresAt: expiresAt.getTime(),
    });

    console.log(`[VERIFICATION CODE GENERATED] ${cleanEmail} -> ${verificationCode}`);

    // Send verification email via SMTP
    const mailOptions = {
      from: `"AIV Support" <${process.env.SMTP_USER || 'hello@aivhub.com'}>`,
      to: cleanEmail,
      subject: `Your AIV Support verification code is: ${verificationCode}`,
      text: `Hello ${firstName || 'there'},\n\nYour 6-digit verification code to activate your AIV Support Portal account is:\n\n${verificationCode}\n\nThis code will expire in 10 minutes.\n\nThank you,\nAIV Support Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
            <div style="background: #2563eb; color: #fff; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; text-align: center; line-height: 36px;">A</div>
            <span style="font-size: 20px; font-weight: bold; color: #0f172a;">AIV Support Portal</span>
          </div>
          <h2 style="font-size: 18px; color: #1e293b; margin-top: 0;">Verify your email address</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hello <strong>${firstName || 'User'}</strong>,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">Please use the following 6-digit verification code to complete your registration on AIV Support Portal:</p>
          <div style="background: #f1f5f9; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e40af; font-family: monospace;">${verificationCode}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">This verification code will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await smtpTransporter.sendMail(mailOptions);
      console.log(`[SMTP SENT] Verification code successfully sent to ${cleanEmail}`);
    } catch (smtpErr) {
      console.warn(`[SMTP DISPATCH WARNING]: ${smtpErr.message}. Fallback code: ${verificationCode}`);
    }

    // Require verification code screen
    return res.status(200).json({
      requiresVerification: true,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to activate your account.`,
      debugCode: verificationCode,
    });
  } catch (err) {
    console.error('Signup verification error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Verify Code & Create Account
app.post('/auth/v1/verify-signup', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = String(code).trim();

  try {
    // Check in PostgreSQL table or memory cache
    const codeRes = await pool.query(
      `SELECT * FROM public.email_verification_codes 
       WHERE lower(email) = lower($1) AND code = $2 AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );

    let record = codeRes.rows[0];
    if (!record) {
      const mem = pendingVerifications.get(cleanEmail);
      if (mem && mem.code === cleanCode && Date.now() < mem.expiresAt) {
        record = {
          email: cleanEmail,
          first_name: mem.firstName,
          last_name: mem.lastName,
          password_hash: mem.password,
        };
      }
    }

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired verification code. Please check your email or request a new code.' });
    }

    // Resolve default company account
    const defAcct = await pool.query('SELECT id FROM public.accounts WHERE status = \'ACTIVE\' ORDER BY created_at ASC LIMIT 1');
    const accountId = defAcct.rows[0]?.id || null;

    // Create the verified user profile in PostgreSQL
    const insertRes = await pool.query(
      `INSERT INTO public.profiles (email, password_hash, first_name, last_name, user_type, account_id, status)
       VALUES ($1, $2, $3, $4, 'customer_user', $5, 'active')
       RETURNING *`,
      [cleanEmail, record.password_hash, record.first_name, record.last_name, accountId]
    );

    // Delete used verification code
    await pool.query('DELETE FROM public.email_verification_codes WHERE lower(email) = lower($1)', [cleanEmail]);
    pendingVerifications.delete(cleanEmail);

    const user = insertRes.rows[0];
    const authUser = {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { first_name: user.first_name, last_name: user.last_name, user_type: user.user_type },
      created_at: user.created_at,
    };

    const session = {
      access_token: 'local-jwt-token',
      token_type: 'bearer',
      expires_in: 86400,
      user: authUser,
    };

    console.log(`✅ [USER VERIFIED & ACTIVATED] ${cleanEmail}`);
    return res.status(200).json({ success: true, session, user: authUser });
  } catch (err) {
    console.error('Code verification error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/v1/token', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM public.profiles WHERE lower(email) = lower($1) LIMIT 1', [email]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Account does not exist. Please sign up first.' });
    }

    // Check password if stored
    if (user.password_hash && user.password_hash !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
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
      app_metadata: { provider: 'email' },
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

// --- PostgREST Compatibility Layer for PostgreSQL-js Client ---

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
      // Auto-generate ticket_number and auto-assign if inserting into tickets
      if (table === 'tickets') {
        if (!record.ticket_number) {
          const nextNum = Math.floor(100000 + Math.random() * 900000);
          record.ticket_number = `AIV-${nextNum}`;
        }

        // Automatic Routing & Least-Loaded Agent Assignment
        if (!record.assigned_agent_id) {
          try {
            // 1. Resolve default support team if not provided
            if (!record.assigned_team_id && record.account_id) {
              const accTeamRes = await pool.query('SELECT support_team_id FROM public.accounts WHERE id = $1', [record.account_id]);
              if (accTeamRes.rows[0]?.support_team_id) {
                record.assigned_team_id = accTeamRes.rows[0].support_team_id;
              }
            }

            // If still no team, pick the first active support team
            if (!record.assigned_team_id) {
              const defaultTeamRes = await pool.query('SELECT id FROM public.support_teams WHERE is_active = true ORDER BY name LIMIT 1');
              if (defaultTeamRes.rows[0]?.id) {
                record.assigned_team_id = defaultTeamRes.rows[0].id;
              }
            }

            // 2. Find eligible active agents in the assigned team (or any active agent if none in team)
            let agentRes;
            if (record.assigned_team_id) {
              try {
                agentRes = await pool.query(
                  `SELECT p.id, COUNT(t.id) AS open_tickets_count
                   FROM public.profiles p
                   JOIN public.support_team_members stm ON (stm.user_id = p.id OR stm.agent_id = p.id)
                   LEFT JOIN public.tickets t ON t.assigned_agent_id = p.id AND t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
                   WHERE stm.team_id = $1 AND p.user_type IN ('agent', 'manager') AND p.status = 'active'
                   GROUP BY p.id
                   ORDER BY open_tickets_count ASC, p.first_name ASC
                   LIMIT 1`,
                  [record.assigned_team_id]
                );
              } catch (teamAssignErr) {
                console.warn('[TEAM-ASSIGNMENT QUERY WARNING]:', teamAssignErr.message);
              }
            }

            // Fallback: Pick any active agent/manager with lowest open ticket workload
            if (!agentRes || agentRes.rows.length === 0) {
              agentRes = await pool.query(
                `SELECT p.id, COUNT(t.id) AS open_tickets_count
                 FROM public.profiles p
                 LEFT JOIN public.tickets t ON t.assigned_agent_id = p.id AND t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
                 WHERE p.user_type IN ('agent', 'manager', 'admin') AND p.status = 'active'
                 GROUP BY p.id
                 ORDER BY open_tickets_count ASC, p.first_name ASC
                 LIMIT 1`
              );
            }

            if (agentRes.rows.length > 0) {
              record.assigned_agent_id = agentRes.rows[0].id;
              console.log(`[AUTO-ASSIGNMENT] Assigned ${record.ticket_number} to Agent: ${record.assigned_agent_id} (Team: ${record.assigned_team_id || 'Global'})`);
            }
          } catch (assignErr) {
            console.warn('[AUTO-ASSIGNMENT ERROR]:', assignErr.message);
          }
        }
      }

      // UUID format regex
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      // Handle id column if not a valid UUID (gen_random_uuid)
      if (record.id && !uuidRegex.test(record.id)) {
        delete record.id;
      }

      // Handle account_id if invalid UUID (e.g. 'acc-1')
      if (record.account_id && !uuidRegex.test(record.account_id)) {
        record.account_id = '00000000-0000-0000-0000-000000001001';
      }

      const keys = Object.keys(record);
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map((k) => record[k]);

      const sql = `INSERT INTO public."${table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
      const result = await pool.query(sql, values);
      const inserted = result.rows[0];
      insertedRows.push(inserted);

      // If a ticket was inserted with an assigned agent, log to ticket_assignment_history
      if (table === 'tickets' && inserted.assigned_agent_id) {
        try {
          await pool.query(
            `INSERT INTO public.ticket_assignment_history (ticket_id, to_agent_id, to_team_id, changed_by_user_id)
             VALUES ($1, $2, $3, $4)`,
            [inserted.id, inserted.assigned_agent_id, inserted.assigned_team_id, inserted.created_by_user_id]
          );
        } catch (histErr) {
          console.warn('[ASSIGNMENT HISTORY ERROR]:', histErr.message);
        }
      }
    }

    // PostgreSQL single() returns single object if not array
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
  console.log(`📡 Point VITE_POSTGRES_URL=http://localhost:${PORT} in your .env\n`);
});
