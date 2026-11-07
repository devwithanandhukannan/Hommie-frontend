'use client';
import { useEffect, useState } from 'react';
import { del, get, getBlob, post, upload } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, PageHeader, Sheet, Spinner, useAction, useConfirm } from '@/components/ui';

function Photo({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url; let alive = true;
    getBlob(`/attachments/${id}`).then((b) => { if (alive) { url = URL.createObjectURL(b); setSrc(url); } }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return src ? <img src={src} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} /> : null;
}

function RecipeForm({ onClose, onDone }) {
  const { t } = useAuth();
  const [f, setF] = useState({ title: '', ingredients: '', steps: '', tags: '' });
  const [file, setFile] = useState(null);
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const lines = (text) => text.split('\n').map((x) => x.trim()).filter(Boolean);
    const body = {
      title: f.title.trim(),
      ingredients: lines(f.ingredients).slice(0, 60).map((l) => { const [name, ...q] = l.split(' - '); return { name: name.trim().slice(0, 80), qty: q.join(' - ').trim().slice(0, 30) }; }),
      steps: lines(f.steps).slice(0, 40), tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8),
    };
    const ok = await run(async () => {
      if (file) { const fd = new FormData(); fd.append('file', file); body.photoId = (await upload('/attachments', fd)).id; }
      return post('/recipes', body);
    }, 'Recipe shared');
    if (ok) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('recipes.share_btn')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('recipes.field_name')}>{(id) => <Input id={id} required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
        <Field label={t('recipes.field_ingredients')} hint={t('recipes.ingredients_hint')}>{(id) => <textarea id={id} className="textarea" rows={5} value={f.ingredients} onChange={(e) => setF({ ...f, ingredients: e.target.value })} />}</Field>
        <Field label={t('recipes.field_steps')} hint={t('recipes.steps_hint')}>{(id) => <textarea id={id} className="textarea" rows={5} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} />}</Field>
        <Field label={t('recipes.field_tags')} hint="Comma separated">{(id) => <Input id={id} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="breakfast, quick" />}</Field>
        <Field label={t('recipes.field_photo')}>{(id) => <input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />}</Field>
        <Btn type="submit" disabled={busy}>{t('recipes.share_btn')}</Btn>
      </form>
    </Sheet>
  );
}

function RecipeView({ id, onClose, onDeleted }) {
  const { me, family, t } = useAuth();
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const [run] = useAction();
  const confirm = useConfirm();
  useEffect(() => { get(`/recipes/${id}`).then(setR).catch(setErr); }, [id]);
  return (
    <Sheet title={r?.title || t('recipes.title')} onClose={onClose}>
      {err ? <ErrorNote error={err} /> : !r ? <Spinner /> : (
        <div className="col">
          {r.photoId ? <Photo id={r.photoId} /> : null}
          <div className="small muted">Shared by {r.createdBy?.displayName}</div>
          <div className="row wrap">{r.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
          <h2>{t('recipes.field_ingredients')}</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{r.ingredients.map((i, n) => <li key={n}>{i.name}{i.qty ? ` — ${i.qty}` : ''}</li>)}</ul>
          <h2>{t('recipes.field_steps')}</h2>
          <ol style={{ margin: 0, paddingLeft: 18 }}>{r.steps.map((s, n) => <li key={n} style={{ marginBottom: 6 }}>{s}</li>)}</ol>
          <div className="row wrap">
            <Btn onClick={() => run(() => post(`/recipes/${id}/add-to-grocery`, {}), 'Ingredients added to grocery')}>{t('chat.add_grocery')}</Btn>
            {r.createdBy?.membershipId === me || family.myRole !== 'member' ? <Btn tone="ghost" onClick={async () => { if (await confirm('Delete this recipe?') && await run(() => del(`/recipes/${id}`), 'Deleted')) { onDeleted(); onClose(); } }}>{t('btn.delete')}</Btn> : null}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function RecipesPage() {
  const { t } = useAuth();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(timer); }, [q]);
  const { data, error, loading, reload } = useData(`/recipes${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  return (
    <>
      <PageHeader title={t('recipes.title')} sub={t('recipes.sub')}><Btn onClick={() => setAdding(true)}>{t('recipes.share_btn')}</Btn></PageHeader>
      <Input aria-label="Search recipes" type="search" placeholder={t('recipes.search_placeholder')} maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : data.length === 0 ? <Empty>{t('recipes.empty')}</Empty> : (
        <div className="card list" style={{ marginTop: 12 }}>
          {data.map((r) => (
            <button key={r.id} type="button" className="item" style={{ textAlign: 'left', width: '100%', background: 'none', border: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => setOpen(r.id)}>
              <div className="grow"><div className="bold">{r.title}</div><div className="small muted">by {r.createdBy?.displayName}{r.tags.length ? ` · ${r.tags.join(', ')}` : ''}</div></div>
              {r.hasPhoto ? <Badge>{t('chat.photo_chip')}</Badge> : null}
            </button>
          ))}
        </div>
      )}
      {adding ? <RecipeForm onClose={() => setAdding(false)} onDone={reload} /> : null}
      {open ? <RecipeView id={open} onClose={() => setOpen(null)} onDeleted={reload} /> : null}
    </>
  );
}
