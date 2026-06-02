import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
mkdirSync(config.dataDir, { recursive: true });
const db = new DatabaseSync(join(config.dataDir, 'tutor.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario TEXT,
    started  TEXT,
    ended    TEXT
  );
  CREATE TABLE IF NOT EXISTS turns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER,
    role        TEXT,
    content     TEXT,
    correction  TEXT,
    stt_ms      INTEGER,
    llm_ms      INTEGER,
    tts_ms      INTEGER,
    ts          TEXT,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
`);
export class Session {
    id;
    constructor(scenarioId) {
        const stmt = db.prepare('INSERT INTO sessions (scenario, started) VALUES (?, ?)');
        const result = stmt.run(scenarioId, new Date().toISOString());
        this.id = result.lastInsertRowid;
    }
    logTurn(role, content, correction, t) {
        db.prepare('INSERT INTO turns (session_id, role, content, correction, stt_ms, llm_ms, tts_ms, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(this.id, role, content, correction ?? null, t?.sttMs ?? null, t?.llmMs ?? null, t?.ttsMs ?? null, new Date().toISOString());
    }
    close() {
        db.prepare('UPDATE sessions SET ended = ? WHERE id = ?').run(new Date().toISOString(), this.id);
    }
}
//# sourceMappingURL=persistence.js.map