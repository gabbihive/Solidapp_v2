import Fastify from 'fastify';
import path from 'path';
import fj from '@fastify/formbody';
import statik from '@fastify/static';
import view from '@fastify/view';
import basicAuth from '@fastify/basic-auth';
import nunjucks from 'nunjucks';

import { db } from './db.js'; // ensure db initializes
import publicRoutes from './routes/public.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';

const app = Fastify({ logger: true });
app.register(fj);
app.register(statik, { root: path.join(process.cwd(), 'public'), prefix: '/public/' });
app.register(view, { engine: { nunjucks }, root: path.join(process.cwd(), 'src', 'views'), viewExt: 'njk' });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
await app.register(basicAuth, {
  validate: async (username, password) => {
    if (username !== 'admin' || password !== ADMIN_PASSWORD) throw new Error('Unauthorized');
  },
  authenticate: true
});

const SITE_NAME = process.env.SITE_NAME || 'Solidapp';
const SITE_TAGLINE = process.env.SITE_TAGLINE || 'Mutual aid, offers, and questions — no login.';
const ADMIN_SLUG = process.env.ADMIN_SLUG || 'admin-9f2a7c1b';

app.addHook('preHandler', async (req, reply) => {
  reply.locals = { SITE_NAME, SITE_TAGLINE, ADMIN_SLUG };
});

app.register(publicRoutes);
app.register(apiRoutes);
app.register(adminRoutes);

const port = parseInt(process.env.PORT || '8080', 10);
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`Listening on ${port}`));