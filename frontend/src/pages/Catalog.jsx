import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function CatalogScreen({ user, navigate, goBack, cities, selectedCity, showNotice }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState(selectedCity);

  // Only tier2 can access
  if (user?.tariff !== 'tier2') {
    return <div className="screen fade-in">
      <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Все участники</h2></div>
      <div className="empty-state">
        <div className="icon">🔒</div>
        <h3>Каталог доступен на тарифе «Уровень 2»</h3>
        <p className="text-muted" style={{ marginBottom: 20 }}>Перейдите на тариф для доступа к каталогу всех участников</p>
        <button className="btn btn-primary" style={{ maxWidth: 280, margin: '0 auto' }} onClick={() => navigate('tariffs', { suggestTier: 'tier2' })}>Выбрать тариф</button>
      </div>
    </div>;
  }

  useEffect(() => { loadUsers(); }, [cityFilter]);

  async function loadUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cityFilter) params.set('city_id', cityFilter);
      if (search) params.set('search', search);
      const data = await api.get(`/api/participants?${params}`);
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  }

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Все участники</h2></div>
    <div className="input-group">
      <select className="input" value={cityFilter || ''} onChange={e => setCityFilter(e.target.value ? parseInt(e.target.value) : '')}>
        <option value="">Все города</option>
        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <input className="input" style={{ marginBottom: 0, flex: 1 }} value={search}
        onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, интересам..."
        onKeyDown={e => e.key === 'Enter' && loadUsers()} />
      <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} onClick={loadUsers}>🔍</button>
    </div>
    {loading && <div className="loading"><div className="spinner" /></div>}
    {!loading && users.length === 0 && <div className="empty-state"><div className="icon">👥</div><h3>Никого не найдено</h3><p className="text-muted">Попробуйте изменить параметры поиска</p></div>}
    {users.map(u => {
      const initial = u.full_name?.charAt(0)?.toUpperCase() || '?';
      return <div key={u.id} className="user-card" onClick={() => navigate('user-profile', { userId: u.id })}>
        <div className="avatar" style={{ width: 44, height: 44 }}>
          {u.photo_url || u.avatar_url ? <img src={u.photo_url || u.avatar_url} alt="" />
            : <span className="avatar-placeholder" style={{ fontSize: 16 }}>{initial}</span>}
        </div>
        <div className="user-card-info">
          <h4>{u.full_name}</h4>
          <p>{u.interests || u.work || 'Нет информации'}</p>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
      </div>;
    })}
    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
  </div>;
}
