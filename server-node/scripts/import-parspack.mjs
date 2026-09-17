import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { loadConfig } from '../src/config.mjs';
import { assertDatabaseHealthy } from '../src/db.mjs';

const TABLE_ORDER = [
  'schema_migrations',
  'admin_users',
  'menu_state',
  'menu_categories',
  'media_assets',
  'menu_items',
  'menu_item_options',
  'menu_revisions',
];
const ALLOWED_TABLES = new Set(TABLE_ORDER);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--sql' || token === '--db') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${token} requires a value`);
      args[token.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  if (!args.sql) throw new Error('usage: npm run import:parspack -- --sql /path/to/dump.sql [--db /path/to/site.sqlite]');
  return args;
}

function findStatementEnd(input, start) {
  let quoted = false;
  let escaped = false;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === "'") {
        if (input[index + 1] === "'") {
          index += 1;
          continue;
        }
        quoted = false;
      }
      continue;
    }
    if (char === "'") {
      quoted = true;
      continue;
    }
    if (char === ';') return index;
  }
  throw new Error('unterminated INSERT statement');
}

function decodeEscape(char) {
  switch (char) {
    case '0': return '\0';
    case 'b': return '\b';
    case 'n': return '\n';
    case 'r': return '\r';
    case 't': return '\t';
    case 'Z': return '\x1a';
    default: return char;
  }
}

function parseRows(input) {
  const rows = [];
  let index = 0;

  function skipSpaceAndCommas() {
    while (index < input.length && /[\s,]/.test(input[index])) index += 1;
  }

  function parseQuoted() {
    index += 1;
    let value = '';
    while (index < input.length) {
      const char = input[index++];
      if (char === '\\') {
        if (index >= input.length) throw new Error('unterminated SQL escape');
        value += decodeEscape(input[index++]);
        continue;
      }
      if (char === "'") {
        if (input[index] === "'") {
          value += "'";
          index += 1;
          continue;
        }
        return value;
      }
      value += char;
    }
    throw new Error('unterminated SQL string');
  }

  function parseValue() {
    while (/\s/.test(input[index] || '')) index += 1;
    if (input[index] === "'") return parseQuoted();
    const start = index;
    while (index < input.length && !/[,)\s]/.test(input[index])) index += 1;
    const token = input.slice(start, index);
    if (token.toUpperCase() === 'NULL') return null;
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
    throw new Error(`unsupported SQL value token: ${token}`);
  }

  skipSpaceAndCommas();
  while (index < input.length) {
    if (input[index] !== '(') throw new Error(`expected row at offset ${index}`);
    index += 1;
    const row = [];
    while (true) {
      row.push(parseValue());
      while (/\s/.test(input[index] || '')) index += 1;
      if (input[index] === ',') {
        index += 1;
        continue;
      }
      if (input[index] === ')') {
        index += 1;
        break;
      }
      throw new Error(`expected comma or closing parenthesis at offset ${index}`);
    }
    rows.push(row);
    skipSpaceAndCommas();
  }
  return rows;
}

function collectInserts(sql) {
  const byTable = new Map();
  const header = /INSERT INTO\s+`([^`]+)`\s*\(([^)]*)\)\s*VALUES\s*/g;
  for (let match = header.exec(sql); match; match = header.exec(sql)) {
    const table = match[1];
    if (!ALLOWED_TABLES.has(table)) continue;
    const columns = [...match[2].matchAll(/`([^`]+)`/g)].map((item) => item[1]);
    if (columns.length === 0) throw new Error(`no columns found for ${table}`);
    const end = findStatementEnd(sql, header.lastIndex);
    const rows = parseRows(sql.slice(header.lastIndex, end));
    const entries = byTable.get(table) || [];
    entries.push({ columns, rows });
    byTable.set(table, entries);
    header.lastIndex = end + 1;
  }
  return byTable;
}

function tableColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((row) => row.name));
}

function assertEmptyTarget(db) {
  for (const table of TABLE_ORDER) {
    if (table === 'schema_migrations') continue;
    const count = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
    if (count !== 0) throw new Error(`target table ${table} is not empty (${count} rows)`);
  }
}

const args = parseArgs(process.argv.slice(2));
const config = loadConfig();
const dbPath = path.resolve(args.db || config.dbPath);
const sqlPath = path.resolve(args.sql);
if (!fs.existsSync(sqlPath)) throw new Error(`SQL dump not found: ${sqlPath}`);
if (!fs.existsSync(dbPath)) throw new Error(`SQLite DB not found: ${dbPath}; run npm run migrate first`);

const sql = fs.readFileSync(sqlPath, 'utf8');
const inserts = collectInserts(sql);
for (const table of TABLE_ORDER) {
  if (!inserts.has(table)) throw new Error(`required source table has no INSERT data: ${table}`);
}

const db = new Database(dbPath);
try {
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  assertEmptyTarget(db);

  const imported = Object.fromEntries(TABLE_ORDER.map((table) => [table, 0]));
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const table of TABLE_ORDER) {
      const available = tableColumns(db, table);
      for (const statement of inserts.get(table)) {
        for (const column of statement.columns) {
          if (!available.has(column)) throw new Error(`source column ${table}.${column} is not present in target schema`);
        }
        const quotedColumns = statement.columns.map((column) => `"${column}"`).join(', ');
        const placeholders = statement.columns.map(() => '?').join(', ');
        const prefix = table === 'schema_migrations' ? 'INSERT OR IGNORE' : 'INSERT';
        const insert = db.prepare(`${prefix} INTO "${table}" (${quotedColumns}) VALUES (${placeholders})`);
        for (const row of statement.rows) {
          if (row.length !== statement.columns.length) {
            throw new Error(`column/value mismatch in ${table}: ${statement.columns.length} columns, ${row.length} values`);
          }
          insert.run(...row);
          imported[table] += 1;
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }

  assertDatabaseHealthy(db);
  const state = db.prepare('SELECT edit_revision, published_revision FROM menu_state WHERE id = 1').get();
  console.log(JSON.stringify({
    ok: true,
    dbPath,
    source: path.basename(sqlPath),
    imported,
    menuState: state,
    migratedLiveSessions: false,
  }, null, 2));
} finally {
  db.close();
}
