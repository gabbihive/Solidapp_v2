import { all, get, run } from '../db.js';

export default async function (app, opts) {
  const ADMIN_SLUG = process.env.ADMIN_SLUG || 'admin-9f2a7c1b';

  app.get(`/${ADMIN_SLUG}`, { preHandler: app.basicAuth }, async (req, reply) => {
    const posts = all(`SELECT p.*, s.slug as section_slug FROM posts p JOIN sections s ON s.id=p.section_id ORDER BY p.created_at DESC LIMIT 200`);
    const comments = all(`SELECT * FROM comments ORDER BY created_at DESC LIMIT 200`);
    const sections = all(`SELECT * FROM sections ORDER BY name`);
    const tags = all(`SELECT * FROM tags ORDER BY name`);
    return reply.view('admin.njk', { posts, comments, sections, tags, ADMIN_SLUG });
  });

  app.post(`/${ADMIN_SLUG}/post/:id/:action`, { preHandler: app.basicAuth }, async (req, reply) => {
    const { id, action } = req.params;
    const allowed = ['hide','show','freeze','delete','pin','unpin'];
    if (!allowed.includes(action)) return reply.code(400).send('Bad action');
    let statusSql = null;
    let params = { id };
    if (action === 'pin') { run(`UPDATE posts SET is_sticky=1 WHERE id=@id`, params); }
    else if (action === 'unpin') { run(`UPDATE posts SET is_sticky=0 WHERE id=@id`, params); }
    else {
      const status = action === 'show' ? 'visible' : (action === 'hide' ? 'hidden' : (action === 'freeze' ? 'frozen' : 'deleted'));
      run(`UPDATE posts SET status=@s WHERE id=@id`, { s: status, id });
    }
    reply.redirect(`/${ADMIN_SLUG}`);
  });

  app.post(`/${ADMIN_SLUG}/comment/:id/:action`, { preHandler: app.basicAuth }, async (req, reply) => {
    const { id, action } = req.params;
    const allowed = ['hide','show','freeze','delete'];
    if (!allowed.includes(action)) return reply.code(400).send('Bad action');
    const status = action === 'show' ? 'visible' : (action === 'hide' ? 'hidden' : (action === 'freeze' ? 'frozen' : 'deleted'));
    run(`UPDATE comments SET status=@s WHERE id=@id`, { s: status, id });
    reply.redirect(`/${ADMIN_SLUG}`);
  });

  app.post(`/${ADMIN_SLUG}/sections`, { preHandler: app.basicAuth }, async (req, reply) => {
    const { slug, name, description, is_active } = req.body || {};
    if (!slug || !name) return reply.code(400).send('Missing');
    run(`
      INSERT INTO sections(slug,name,description,is_active) VALUES(@slug,@name,@desc,@active)
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description, is_active=excluded.is_active
    `, { slug, name, desc: description || '', active: is_active ? 1 : 0 });
    reply.redirect(`/${ADMIN_SLUG}`);
  });

  app.post(`/${ADMIN_SLUG}/tags`, { preHandler: app.basicAuth }, async (req, reply) => {
    const { slug, name, color } = req.body || {};
    if (!slug || !name) return reply.code(400).send('Missing');
    run(`
      INSERT INTO tags(slug,name,color) VALUES(@slug,@name,@color)
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name, color=excluded.color
    `, { slug, name, color: color || '#4fa3ff' });
    reply.redirect(`/${ADMIN_SLUG}`);
  });

  app.post(`/${ADMIN_SLUG}/post/:id/tags`, { preHandler: app.basicAuth }, async (req, reply) => {
    const { id } = req.params;
    const { tag_ids = [] } = req.body || {};
    run(`DELETE FROM post_tags WHERE post_id=@p`, { p: id });
    if (Array.isArray(tag_ids)) {
      for (const tid of tag_ids) run(`INSERT OR IGNORE INTO post_tags(post_id, tag_id) VALUES(@p,@t)`, { p: id, t: parseInt(tid,10) });
    }
    reply.redirect(`/${ADMIN_SLUG}`);
  });
}