// completions-pg.js
import crypto from 'crypto';

const createTableSQL = `
CREATE TABLE IF NOT EXISTS completions (
  id          SERIAL PRIMARY KEY,
  model       TEXT     NOT NULL,
  prompt_hash TEXT     NOT NULL,
  prompt      JSONB    NOT NULL,  -- native JSONB
  response    JSONB    NOT NULL,  -- native JSONB
  gold        JSONB,              -- native JSONB
  label       TEXT     DEFAULT 'new',
  took        INTEGER,
  cost        NUMERIC,
  groupid     TEXT,
  created     TIMESTAMPTZ DEFAULT NOW(),
  updated     TIMESTAMPTZ,
  isdeleted   BOOLEAN  DEFAULT FALSE
);
`;

// helpers --------------------------------------------------------------------

const getHash = (prompt) =>
  crypto.createHash('sha256').update(JSON.stringify(prompt)).digest('base64');

const all = (res) =>
  res&&res.rows?res.rows:null;

const first = (res) =>
  res&&res.rows&&res.rows.length?res.rows[0]:null;


// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

class PGCompletions {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function')
      throw new Error('Completions expects a pg.Pool');
    this.pool = pool;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    const client = await this.pool.connect();
    await client.query(createTableSQL);
    this.initialized = true;
  }

  /*
  *
  * Read query
  *
  */
  async _query(text, params) {
    let client = null;
    let res = null;
    try {
      client = await this.pool.connect();
      res = await client.query(text, params);
    } catch (ex) {
      console.error(ex);
    } finally {
      if (client) await client.release();      
    }
    return res;
  }

  /*
  *
  * Atomic write query that will rollback on error
  *
  */
  async _atomic(text, params, rethrow) {
    let client = null;
    let res = null;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      res = await client.query(text, params);
      await client.query('COMMIT');
    } catch (ex) {
      if (client) await client.query('ROLLBACK');
      if (rethrow) {
        throw ex;
      } else {
        console.error(ex);
      }
    } finally {
      if (client) await client.release();      
    }
    return res;
  }


  // -------------------------------------------------------------------------
  // Public API (identical signature to SQLite version)
  // -------------------------------------------------------------------------

  async findByPrompt(prompt, groupid) {
    await this.init();
    const sql = `
      SELECT id, model, prompt_hash, prompt, response, gold, label, took, cost, groupid, created, updated
      FROM completions
      WHERE prompt = $1::jsonb AND groupid = $2 AND isdeleted = FALSE;
    `;
    const res = await _query(sql, [prompt, groupid]);
    return all(res);
  }

  async findByPromptHash(model, prompt, groupid) {
    await this.init();
    const prompt_hash = getHash(prompt);

    let idx = 1;
    const params = [model, prompt_hash];
    let sql = `
      SELECT id, model, prompt_hash, prompt, response, gold, label, took, cost, groupid, created, updated
      FROM completions
      WHERE model = $${idx++} AND prompt_hash = $${idx++} AND isdeleted = FALSE
    `;

    if (groupid) {
      sql += ` AND groupid = $${idx++}`;
      params.push(groupid);
    }

    const res = await _query(sql, params);
    return all(res);
  }

  /**
   * @param {Object}  options
   * @param {string=} options.groupid
   * @param {string=} options.start
   * @param {string=} options.end
   * @param {'day'|'hour'=} options.interval
   */
  async costSummary({ groupid, start, end, interval } = {}) {
    await this.init();

    const filters = ['isdeleted = FALSE'];
    const params = [];
    let idx = 1;

    if (groupid) {
      filters.push(`groupid = $${idx++}`);
      params.push(groupid);
    }
    if (start) {
      filters.push(`created >= $${idx++}`);
      params.push(start);
    }
    if (end) {
      filters.push(`created < $${idx++}`);
      params.push(end);
    }

    let groupExpr = 'groupid';
    if (interval) {
      if (!['day', 'hour'].includes(interval))
        throw new Error("interval must be 'day' or 'hour'");
      groupExpr = `date_trunc('${interval}', created)`;
    }

    const sql = `
      SELECT 
        ${groupExpr} AS bucket,
        COUNT(*)  AS count,
        SUM(cost) AS total_cost,
        AVG(cost) AS avg_cost
      FROM completions
      WHERE ${filters.join(' AND ')}
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const res = await _query(sql, params);
    return all(res);
  }

  async create(model, prompt, response, took, cost, groupid) {
    await this.init();
    const sql = `
      INSERT INTO completions
        (model, prompt_hash, prompt, response, label, took, cost, groupid)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;
    const values = [model, getHash(prompt), prompt, response, 'new', took, cost, groupid, ];
    const res = await _atomic(sql, values);
    const row = first(res);
    return first?.id||null;
  }
}

export default PGCompletions;
