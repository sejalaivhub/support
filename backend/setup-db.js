const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT, 10) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
};

const targetDb = process.env.PG_DATABASE || 'support';

async function init() {
  // Connect to default 'postgres' database to check/create target database
  const client = new Client({
    ...config,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to default postgres database.');

    const checkRes = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (checkRes.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating it now...`);
      await client.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`Database "${targetDb}" created successfully.`);
    } else {
      console.log(`Database "${targetDb}" already exists.`);
    }
    await client.end();

    // Now connect to targetDb to create tables
    const targetClient = new Client({
      ...config,
      database: targetDb,
    });
    await targetClient.connect();
    console.log(`Connected to target database "${targetDb}".`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await targetClient.query(sql);
      console.log('SUCCESS: All schema tables and initial records created in PostgreSQL!');
    }
    await targetClient.end();
    process.exit(0);
  } catch (err) {
    console.error('ERROR during setup:', err.message);
    process.exit(1);
  }
}

init();
