// src/seed.js
import { run } from './db.js';

const now = () => Math.floor(Date.now() / 1000);

function mdToHtml(md) {
  // keep this simple for seeding; your app renders markdown at runtime anyway
  return `<p>${(md || '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`;
}

async function seed() {
  console.log('🌱 Seeding database...');

  // FK-safe clears (child -> parent)
  run(`DELETE FROM post_tags`);
  run(`DELETE FROM comments`);
  run(`DELETE FROM posts`);
  run(`DELETE FROM tags`);
  run(`DELETE FROM sections`);

  // Sections
  const s1 = run(`INSERT INTO sections (name, slug, description, is_active) VALUES (@n,@s,@d,1)`, {
    n: 'General Discussion', s: 'general', d: 'General topics and mutual aid'
  });
  const s2 = run(`INSERT INTO sections (name, slug, description, is_active) VALUES (@n,@s,@d,1)`, {
    n: 'Tech', s: 'tech', d: 'Technology help, offers, and questions'
  });

  // Tags
  const tNews = run(`INSERT INTO tags (name, slug, color) VALUES ('News','news','#4fa3ff')`);
  const tQuestion = run(`INSERT INTO tags (name, slug, color) VALUES ('Question','question','#6ee16e')`);
  const tOpinion = run(`INSERT INTO tags (name, slug, color) VALUES ('Opinion','opinion','#e1c56e')`);

  // Posts (use body_md + body_html + required fields)
  const ts1 = now();
  const p1 = run(
    `INSERT INTO posts (section_id,title,body_md,body_html,kind,score,status,is_sticky,created_at)
     VALUES (@sid,@title,@md,@html,'request',0,'visible',1,@ts)`,
    {
      sid: s1.lastInsertRowid,
      title: 'Welcome to Solidapp2',
      md: 'This is the first post in **General Discussion**.',
      html: mdToHtml('This is the first post in **General Discussion**.'),
      ts: ts1
    }
  );

  const ts2 = now();
  const p2 = run(
    `INSERT INTO posts (section_id,title,body_md,body_html,kind,score,status,is_sticky,created_at)
     VALUES (@sid,@title,@md,@html,'question',0,'visible',0,@ts)`,
    {
      sid: s2.lastInsertRowid,
      title: 'Tech News Today',
      md: 'Discuss the latest in technology here.',
      html: mdToHtml('Discuss the latest in technology here.'),
      ts: ts2
    }
  );

  // Post ↔ Tag
  run(`INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (@p,@t)`, { p: p1.lastInsertRowid, t: tNews.lastInsertRowid });
  run(`INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (@p,@t)`, { p: p2.lastInsertRowid, t: tQuestion.lastInsertRowid });

  console.log('✅ Seeding complete');
}

seed().catch((err) => {
  console.error('❌ Error seeding database:', err);
  process.exit(1);
});