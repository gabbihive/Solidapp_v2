const TOKEN_KEY = 'solidapp_token';

async function getToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    const payload = btoa(JSON.stringify({ lastTs: 0, min: 0 }));
    t = payload + '.' + Math.random().toString(16).slice(2);
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

// Voting
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.vote');
  if (!btn) return;
  e.preventDefault();

  const type = btn.dataset.type;      // "post" | "comment"
  const id = Number(btn.dataset.id);
  const dir = Number(btn.dataset.dir);
  const token = await getToken();

  const res = await fetch(`/api/${type === 'post' ? 'posts' : 'comments'}/${id}/vote`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ direction: dir, token })
  });

  if (res.ok) location.reload();
});

// Compose post
const postForm = document.getElementById('post-form');
if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = document.getElementById('post-status');

    try {
      const fd = new FormData(postForm);
      const tag_ids = fd.getAll('tag_ids').map(v => Number(v)).filter(n => Number.isFinite(n));
      const section_id = Number(fd.get('section_id'));
      const title = (fd.get('title') || '').trim();
      const body_md = (fd.get('body_md') || '').trim();
      const kind = (fd.get('kind') || 'request').trim();
      const token = await getToken();

      if (!section_id || !title || !body_md) {
        s.textContent = 'Error: missing required fields.';
        return;
      }

      const r = await fetch('/api/posts', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ section_id, title, body_md, kind, tag_ids, token })
      });

      let data = null;
      try { data = await r.json(); } catch { /* leave null */ }

      if (!r.ok) {
        const msg = (data && data.error) ? data.error : `HTTP ${r.status}`;
        s.textContent = 'Error: ' + msg;
        console.error('Create post failed:', msg, data);
        return;
      }

      if (!data || typeof data.id !== 'number') {
        s.textContent = 'Error: server did not return a post id.';
        console.error('Create post bad response:', data);
        return;
      }

      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      s.textContent = 'Posted. Redirecting...';
      setTimeout(() => location.href = `/p/${data.id}`, 200);
    } catch (err) {
      console.error(err);
      s.textContent = 'Unexpected error submitting post.';
    }
  });
}

// Comment form
const cform = document.querySelector('.comment-form');
if (cform){
  cform.addEventListener('submit', async (e)=>{
    e.preventDefault();
    try {
      const fd = new FormData(cform);
      const post_id = Number(cform.dataset.post);
      const body_md = (fd.get('body_md') || '').trim();
      const token = await getToken();

      const r = await fetch('/api/comments', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ post_id, body_md, token })
      });

      const data = await r.json().catch(() => null);
      if (r.ok) {
        if (data?.token) localStorage.setItem(TOKEN_KEY, data.token);
        location.reload();
      } else {
        alert('Error submitting comment: ' + (data?.error || `HTTP ${r.status}`));
      }
    } catch (err) {
      console.error(err);
      alert('Unexpected error submitting comment.');
    }
  });
}