import crypto from 'crypto';
import { run, get, all, tx } from '../db.js';
import { renderMarkdown } from '../util_sanitize.js';

const cooldown = (now, token, minSec) => {
  try {
    const data = JSON.parse(Buffer.from(token.split('.')[0] || '', 'base64').toString('utf8'));
    return now - (data.lastTs || 0) < minSec;
  } catch { return false; }
};
const makeToken = (now, minSec) => {
  const payload = Buffer.from(JSON.stringify({ lastTs: now, min: minSec }), 'utf8').toString('base64');
  const sig = crypto.createHmac('sha256', process.env.TOKEN_SECRET || 'dev').update(payload).digest('hex');
  return `${payload}.${sig}`;
};

function countLinks(text){ const m=(text||'').match(/https?:\/\//gi); return m?m.length:0; }

export default async function (app) {
  const POST_CD = parseInt(process.env.POST_COOLDOWN_SECONDS || '60', 10);
  const COMMENT_CD = parseInt(process.env.COMMENT_COOLDOWN_SECONDS || '30', 10);

  app.post('/api/posts', async (req, reply) => {
    const { section_id, title, body_md, kind = 'request', tag_ids = [], token } = req.body || {};
    const now = Math.floor(Date.now()/1000);
    if (!section_id || !title || !body_md) return reply.code(400).send({ error: 'Missing fields' });
    if (cooldown(now, token || '', POST_CD)) return reply.code(429).send({ error: 'Cooldown in effect' });
    if (countLinks(body_md) > 5) return reply.code(400).send({ error: 'Too many links' });

    const section = get(`SELECT * FROM sections WHERE id=@id AND is_active=1`, { id: section_id });
    if (!section) return reply.code(400).send({ error: 'Invalid section' });

    const body_html = renderMarkdown(body_md);
    let postId;
    tx(() => {
      const info = run(`
        INSERT INTO posts(section_id,title,body_md,body_html,kind,score,is_sticky,status,created_at)
        VALUES (@sid,@title,@md,@html,@kind,0,0,'visible',@ts)
      `, { sid: section_id, title, md: body_md, html: body_html, kind, ts: now });
      postId = info.lastInsertRowid;

      for (const tid of (Array.isArray(tag_ids) ? tag_ids : [])) {
        run(`INSERT OR IGNORE INTO post_tags(post_id, tag_id) VALUES(@p,@t)`, { p: postId, t: parseInt(tid,10) });
      }
    });

    return reply.send({ ok: true, id: postId, token: makeToken(now, POST_CD) });
  });

  app.post('/api/comments', async (req, reply) => {
    const { post_id, parent_id, body_md, token } = req.body || {};
    const now = Math.floor(Date.now()/1000);
    if (!post_id || !body_md) return reply.code(400).send({ error: 'Missing fields' });
    if (cooldown(now, token || '', COMMENT_CD)) return reply.code(429).send({ error: 'Cooldown in effect' });
    const post = get(`SELECT * FROM posts WHERE id=@id AND status='visible'`, { id: post_id });
    if (!post) return reply.code(400).send({ error: 'Invalid post' });
    const body_html = renderMarkdown(body_md);
    const info = run(`
      INSERT INTO comments(post_id,parent_id,body_md,body_html,score,status,created_at)
      VALUES (@pid,@parent,@md,@html,0,'visible',@ts)
    `, { pid: post_id, parent: parent_id || null, md: body_md, html: body_html, ts: now });
    return reply.send({ ok: true, id: info.lastInsertRowid, token: makeToken(now, COMMENT_CD) });
  });

  function voteCommon(entity, id, direction, token) {
    const now = Math.floor(Date.now()/1000);
    if (![1,-1].includes(direction)) return { error: 'Invalid vote' };
    if (!token) return { error: 'Missing token' };
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      run(`INSERT INTO votes(entity_type,entity_id,direction,token_hash,created_at)
           VALUES (@e,@id,@d,@h,@ts)`, { e: entity, id, d: direction, h: tokenHash, ts: now });
    } catch { return { ok: true }; }
    const table = entity === 'post' ? 'posts' : 'comments';
    run(`UPDATE ${table} SET score = score + @delta WHERE id=@id`, { delta: direction, id });
    return { ok: true };
  }

  app.post('/api/posts/:id/vote', async (req, reply) => {
    const id = parseInt(req.params.id,10);
    const { direction, token } = req.body || {};
    const res = voteCommon('post', id, parseInt(direction,10), token);
    if (res.error) return reply.code(400).send(res);
    reply.send(res);
  });
  app.post('/api/comments/:id/vote', async (req, reply) => {
    const id = parseInt(req.params.id,10);
    const { direction, token } = req.body || {};
    const res = voteCommon('comment', id, parseInt(direction,10), token);
    if (res.error) return reply.code(400).send(res);
    reply.send(res);
  });

  app.post('/api/report', async (req, reply) => {
    // kept as a stub for future abuse reporting; no-op for now
    reply.send({ ok: true });
  });

  app.post('/posts', async (req, reply) => {
  const { title, content, section_id } = req.body;
  const info = run(
    'INSERT INTO posts (title, content, section_id, created_at) VALUES (?, ?, ?, datetime("now"))',
    [title, content, section_id]
  );

  // Redirect to new post using the row ID from SQLite
  reply.redirect(`/p/${info.lastInsertRowid}`);
});
}