// src/migrate.js
import Database from 'better-sqlite3';
import fs from 'fs';

const dbFile = './data.db';

// Remove the existing DB if you want a fresh start
if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log('Old database removed.');
}

const db = new Database(dbFile);

// Create tables
db.exec(`
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  votes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);
`);

// Seed initial sections
const insertSection = db.prepare(`INSERT INTO sections (name, description) VALUES (?, ?)`);
insertSection.run('General', 'General discussion');
insertSection.run('Technology', 'All things tech');
insertSection.run('Random', 'Off-topic conversations');

// Seed initial tags
const insertTag = db.prepare(`INSERT INTO tags (name) VALUES (?)`);
['Discussion', 'News', 'Help', 'Showcase'].forEach(tag => insertTag.run(tag));

console.log('Database migrated and seeded successfully.');