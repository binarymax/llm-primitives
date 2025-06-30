// completions-sqlite.js
import crypto from 'crypto';
import sqlite3 from 'sqlite3';

const createTableSQL = `
  CREATE TABLE IF NOT EXISTS completions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model       TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt      TEXT NOT NULL,  -- stored as JSON string
    response    TEXT NOT NULL,  -- stored as JSON string
    gold        TEXT,           -- stored as JSON string
    label       TEXT DEFAULT 'new',
    took        INTEGER,
    cost        NUMERIC,
    groupid     TEXT,
    created     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated     DATETIME,
    isdeleted   BOOLEAN DEFAULT 0
  );
`;

sqlite3.verbose();

// Promise-based helpers.
function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Utility functions.
const generateHash = (text) => {
  const hash = crypto.createHash('sha256');
  hash.update(text);
  return hash.digest('base64');
};

const getHash = (prompt) => generateHash(JSON.stringify(prompt));

class SQLiteCompletions {
  /**
   * @param {string} [dbPath='./database.sqlite'] - Path to the SQLite database file.
   */
  constructor(dbPath = './cache.sqlite') {
    this.dbPath = dbPath;
    this.initialized = false;
  }

  /**
   * Initializes the database connection and creates the completions table if missing.
   */
  async init() {
    const self = this;
    if (self.initialized) return;
    self.db = new sqlite3.Database(
      self.dbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (err) => {
        if (err) throw err;
      }
    );
    await runAsync(self.db, createTableSQL);
    self.initialized = true;
  }

  /**
   * Finds completions matching the provided prompt and groupid.
   * @param {any} prompt - The prompt object (will be stringified).
   * @param {string} groupid - The group identifier.
   * @returns {Promise<Array>} Array of matching completions.
   */
  async findByPrompt(prompt, groupid) {
    await this.init();
    const sql = `
      SELECT id, model, prompt_hash, prompt, response, gold, label, took, cost, groupid, created, updated
      FROM completions
      WHERE prompt = ? AND groupid = ? AND isdeleted = 0;
    `;
    const rows = await allAsync(this.db, sql, [prompt, groupid]);
    return rows.map((r)=>{
      r.prompt = JSON.parse(r.prompt);
      r.response = JSON.parse(r.response);
      return r;
    });    
  }

  /**
   * Finds completions matching the provided model, computed prompt hash, and groupid.
   * @param {string} model - The model identifier.
   * @param {any} prompt - The prompt object (will be stringified and hashed).
   * @param {string} groupid - The group identifier.
   * @returns {Promise<Array>} Array of matching completions.
   */
  async findByPromptHash(model, prompt, groupid) {
    await this.init();
    const prompt_hash = getHash(prompt);
    let values = [model, prompt_hash]
    let sql = `
      SELECT id, model, prompt_hash, prompt, response, gold, label, took, cost, groupid, created, updated
      FROM completions
      WHERE model = ? AND prompt_hash = ? AND isdeleted = 0
    `;

    if(groupid) {
      sql += `AND groupid = ?`;
      values.push(groupid);
    }

    const rows = await allAsync(this.db, sql, values);
    return rows.map((r)=>{
      r.prompt = JSON.parse(r.prompt);
      r.response = JSON.parse(r.response);
      return r;
    });
  }

  /**
   * Returns summary metrics with optional filters and grouping.
   * - If interval is specified ('day' or 'hour'), groups by time bucket.
   * - Otherwise, groups by groupid.
   * 
   * @param {Object} options
   * @param {string} [options.groupid] - Optional group identifier
   * @param {string} [options.start] - Optional ISO start date (inclusive)
   * @param {string} [options.end] - Optional ISO end date (exclusive)
   * @param {'day' | 'hour'} [options.interval] - Optional grouping interval
   * @returns {Promise<Array>} Aggregated summary records
   */
  async costSummary({ groupid, start, end, interval } = {}) {
    await this.init();

    const params = [];
    const filters = ['isdeleted = 0'];

    // Filters
    if (groupid) {
      filters.push('groupid = ?');
      params.push(groupid);
    }
    if (start) {
      filters.push('created >= ?');
      params.push(start);
    }
    if (end) {
      filters.push('created < ?');
      params.push(end);
    }

    // Grouping
    let groupExpr = 'groupid';
    if (interval) {
      if (!['day', 'hour'].includes(interval)) {
        throw new Error("Invalid interval. Must be 'day' or 'hour'");
      }
      groupExpr = `strftime('${interval === 'day' ? '%Y-%m-%d' : '%Y-%m-%d %H:00:00'}', created)`;
    }

    const sql = `
      SELECT 
        ${groupExpr} AS bucket,
        COUNT(*) AS count,
        SUM(cost) AS total_cost,
        AVG(cost) AS avg_cost
      FROM completions
      WHERE ${filters.join(' AND ')}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return await allAsync(this.db, sql, params);
  }



  /**
   * Creates a new completion record.
   * @param {string} model - The model identifier.
   * @param {any} prompt - The prompt object (will be stringified and hashed).
   * @param {any} response - The response object (will be stringified if necessary).
   * @param {number} took - Execution time.
   * @param {number} cost - Associated cost.
   * @param {string} groupid - The group identifier.
   * @returns {Promise<number>} The ID of the newly inserted completion.
   */
  async create(model, prompt, response, took, cost, groupid) {
    await this.init();
    const sql = `
      INSERT INTO completions(model, prompt_hash, prompt, response, label, took, cost, groupid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const prompt_hash = getHash(prompt);
    const values = [model, prompt_hash, JSON.stringify(prompt), JSON.stringify(response), 'new', took, cost, groupid];
    const result = await runAsync(this.db, sql, values);
    return result.lastID;
  }
}

export default SQLiteCompletions;
