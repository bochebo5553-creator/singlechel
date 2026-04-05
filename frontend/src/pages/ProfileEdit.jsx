import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function ProfileEditScreen({ user, goBack, refreshUser, showNotice }) {
  const [form, setForm] = useState({ work: user?.work || '', interests: user?.interests || '', social_links: user?.social_links || '', about: user?.about || '', phone_visible: !!user?.phone_visible, city_id: user?.city_id || 1 });
  const [cities, setCities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { api.get('/api/cities').then(d => setCities(d.cities || [])); }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try { await api.put('/api/users/profile', form); refreshUser(); showNotice('Анкета сохранена!', 'success'); } catch { showNotice('Ошибка сохранения', 'error'); }
    setSaving(false);
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('photo', file);
    try { await api.upload('/api/users/photo', fd); refreshUser(); showNotice('Фото обновлено!', 'success'); } catch { showNotice('Ошибка загрузки', 'error'); }
    setUploading(false);
  }

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || '?';

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Редактировать анкету</h2></div>
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div className="profile-detail-avatar" style={{ margin: '0 auto 12px', cursor: 'pointer' }} onClick={() => document.getElementById('photo-input').click()}>
        {user?.photo_url || user?.avatar_url ? <img src={user.photo_url || user.avatar_url} alt="" /> : <span className="avatar-placeholder">{initial}</span>}
      </div>
      <input id="photo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
      <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex' }} onClick={() => document.getElementById('photo-input').click()} disabled={uploading}>
        {uploading ? 'Загрузка...' : '📷 Загрузить фото'}
      </button>
    </div>
    <div className="input-group"><label className="input-label">Город</label>
      <select className="input" value={form.city_id} onChange={e => update('city_id', parseInt(e.target.value))}>
        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></div>
    <div className="input-group"><label className="input-label">Работа</label><input className="input" value={form.work} onChange={e => update('work', e.target.value)} placeholder="Профессия или место работы" /></div>
    <div className="input-group"><label className="input-label">Интересы</label><textarea className="input" value={form.interests} onChange={e => update('interests', e.target.value)} placeholder="Спорт, кино, путешествия..." /></div>
    <div className="input-group"><label className="input-label">Социальные сети</label><input className="input" value={form.social_links} onChange={e => update('social_links', e.target.value)} placeholder="Instagram, VK, Telegram..." /></div>
    <div className="input-group"><label className="input-label">О себе</label><textarea className="input" value={form.about} onChange={e => update('about', e.target.value)} placeholder="Расскажите о себе..." style={{ minHeight: 100 }} /></div>
    <div className="toggle-row"><span style={{ fontSize: 14 }}>Показывать телефон в профиле</span><div className={`toggle ${form.phone_visible ? 'on' : ''}`} onClick={() => update('phone_visible', !form.phone_visible)} /></div>
    <div className="gap-16" />
    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Сохранение...' : '💾 Сохранить анкету'}</button>
    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
  </div>;
}
