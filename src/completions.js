// completions.js
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
    userid      TEXT,
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

class Completions {
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
   * Finds completions matching the provided prompt and userid.
   * @param {any} prompt - The prompt object (will be stringified).
   * @param {string} userid - The user identifier.
   * @returns {Promise<Array>} Array of matching completions.
   */
  async findByPrompt(prompt, userid) {
    await this.init();
    const sql = `
      SELECT id, model, prompt_hash, prompt, response, gold, label, took, cost, userid, created, updated
      FROM completions
      WHERE prompt = ? AND userid = ? AND isdeleted = 0;
    `;
    const rows = await allAsync(this.db, sql, [prompt, userid]);
    return rows.map((r)=>{
      r.prompt = JSON.parse(r.prompt);
      r.response = JSON.parse(r.response);
      return r;
    });    
  }

  /**
   * Finds completions matching the provided model, computed prompt hash, and userid.
   * @param {string} model - The model identifier.
   * @param {any} prompt - The prompt object (will be stringified and hashed).
   * @param {string} userid - The user identifier.
   * @returns {Promise<Array>} Array of matching completions.
   */
  async findByPromptHash(model, prompt, userid) {
    await this.init();
    const prompt_hash = getHash(prompt);
    let values = [model, prompt_hash]
    let sql = `
      SELECT id, model, prompt_hash, prompt, response, gold, label, took, cost, userid, created, updated
      FROM completions
      WHERE model = ? AND prompt_hash = ? AND isdeleted = 0
    `;

    if(userid) {
      sql += `AND userid = ?`;
      values.push(userid);
    }

    const rows = await allAsync(this.db, sql, values);
    return rows.map((r)=>{
      r.prompt = JSON.parse(r.prompt);
      r.response = JSON.parse(r.response);
      return r;
    });
  }

  /**
   * Creates a new completion record.
   * @param {string} model - The model identifier.
   * @param {any} prompt - The prompt object (will be stringified and hashed).
   * @param {any} response - The response object (will be stringified if necessary).
   * @param {number} took - Execution time.
   * @param {number} cost - Associated cost.
   * @param {string} userid - The user identifier.
   * @returns {Promise<number>} The ID of the newly inserted completion.
   */
  async create(model, prompt, response, took, cost, userid) {
    await this.init();
    const sql = `
      INSERT INTO completions(model, prompt_hash, prompt, response, label, took, cost, userid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const prompt_hash = getHash(prompt);
    const values = [model, prompt_hash, JSON.stringify(prompt), JSON.stringify(response), 'new', took, cost, userid];
    const result = await runAsync(this.db, sql, values);
    return result.lastID;
  }
}

export default Completions;
