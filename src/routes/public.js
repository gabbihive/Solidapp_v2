import { all, get } from '../db.js';
import { hotScore } from '../util_hot.js';

export default async function (app) {
  app.get('/', async (req, reply) => {
    const { sort = 'hot', q = '', section = '', tag = '' } = req.query;

    let where = "p.status = 'visible'";
    const params = {};
    if (section) { where += ' AND s.slug = @section'; params.section = section; }
    if (q) { where += ' AND (p.title LIKE @q OR p.body_md LIKE @q)'; params.q = `%${q}%`; }
    if (tag) {
      where += ' AND EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=p.id AND t.slug=@tag)';
      params.tag = tag;
    }

    const posts = all(`
      SELECT p.*, s.name AS section_name, s.slug AS section_slug,
             GROUP_CONCAT(t.slug, ',') AS tag_slugs,
             GROUP_CONCAT(t.name, ',') AS tag_names,
             GROUP_CONCAT(t.color, ',') AS tag_colors
      FROM posts p
      JOIN sections s ON s.id = p.section_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE ${where}
      GROUP BY p.id
      ORDER BY p.is_sticky DESC, p.created_at DESC
    `, params);

    for (const r of posts) r.hot = hotScore(r.score, r.created_at);

    posts.sort((a, b) => {
      if (sort === 'new') return b.created_at - a.created_at;
      if (sort === 'top') return b.score - a.score;
      return b.hot - a.hot; // default: hot
    });

    const sections = all(`SELECT * FROM sections WHERE is_active=1 ORDER BY name ASC`);
    const tags = all(`SELECT * FROM tags ORDER BY name ASC`);
    return reply.view('index.njk', { posts, sections, tags, sort, q, section, tag });
  });

  app.get('/s/:slug', async (req, reply) => {
    const { slug } = req.params;
    const section = get(`SELECT * FROM sections WHERE slug=@slug AND is_active=1`, { slug });
    if (!section) return reply.code(404).send('Section not found');

    const posts = all(`
      SELECT p.*, GROUP_CONCAT(t.slug, ',') AS tag_slugs, GROUP_CONCAT(t.name, ',') AS tag_names, GROUP_CONCAT(t.color, ',') AS tag_colors
      FROM posts p
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE p.section_id=@sid AND p.status='visible'
      GROUP BY p.id
      ORDER BY p.is_sticky DESC, p.created_at DESC
    `, { sid: section.id });

    for (const r of posts) r.hot = hotScore(r.score, r.created_at);
    return reply.view('section.njk', { section, posts });
  });

  app.get('/p/:id', async (req, reply) => {
    const { id } = req.params;
    const post = get(`
      SELECT p.*, s.name AS section_name, s.slug AS section_slug
      FROM posts p JOIN sections s ON s.id=p.section_id
      WHERE p.id=@id
    `, { id });

    if (!post || post.status !== 'visible') return reply.code(404).send('Not found');

    const tags = all(`
      SELECT t.* FROM tags t
      JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = @id
      ORDER BY t.name
    `, { id });

    const comments = all(`
      SELECT * FROM comments
      WHERE post_id=@id AND status='visible'
      ORDER BY created_at ASC
    `, { id });

    return reply.view('post.njk', { post, tags, comments });
  });

  app.get('/compose', async (req, reply) => {
    const sections = all(`SELECT * FROM sections WHERE is_active=1 ORDER BY name`);
    const tags = all(`SELECT * FROM tags ORDER BY name`);
    return reply.view('compose.njk', { sections, tags });
  });
}