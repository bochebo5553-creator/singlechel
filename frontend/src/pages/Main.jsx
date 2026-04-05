import React, { useState, useEffect } from 'react';
import { api, formatDate } from '../api.js';

export default function MainScreen({ user, navigate, cities, selectedCity, setSelectedCity, showNotice }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCityPicker, setShowCityPicker] = useState(false);

  useEffect(() => { loadEvents(); }, [selectedCity]);

  async function loadEvents() {
    setLoading(true);
    try { const { events: e } = await api.get(`/api/events?city_id=${selectedCity}`); setEvents(e || []); } catch {}
    setLoading(false);
  }

  const tariffLabel = { free: 'Бесплатный', tier1: 'Уровень 1', tier2: 'Уровень 2' };
  const tariffClass = { free: 'tariff-free', tier1: 'tariff-tier1', tier2: 'tariff-tier2' };
  const cityName = cities.find(c => c.id === selectedCity)?.name || 'Челябинск';
  const initial = user?.full_name?.charAt(0)?.toUpperCase() || '?';
  const isPaid = user?.tariff === 'tier1' || user?.tariff === 'tier2';

  function handleAnketa() {
    if (!isPaid) {
      showNotice('Заполнение анкеты доступно на платном тарифе', 'info');
      navigate('tariffs', { suggestTier: 'tier1' });
    } else {
      navigate('profile');
    }
  }

  function handleCatalog() {
    if (user?.tariff === 'tier2') {
      navigate('catalog');
    } else {
      showNotice('Каталог участников доступен на тарифе «Уровень 2»', 'info');
      navigate('tariffs', { suggestTier: 'tier2' });
    }
  }

  function handleInvite() {
    if (user?.tariff === 'tier2') {
      navigate('catalog');
    } else {
      showNotice('Приглашение участников доступно на тарифе «Уровень 2»', 'info');
      navigate('tariffs', { suggestTier: 'tier2' });
    }
  }

  return <div className="screen fade-in">
    {/* Profile block with Анкета */}
    <div className="profile-block" style={{ flexWrap: 'wrap' }}>
      <div className="avatar" onClick={handleAnketa}>
        {user?.photo_url || user?.avatar_url
          ? <img src={user.photo_url || user.avatar_url} alt="" />
          : <span className="avatar-placeholder">{initial}</span>}
      </div>
      <div className="profile-info" style={{ flex: 1 }} onClick={handleAnketa}>
        <h3>{user?.full_name}</h3>
        {user?.username && <span className="username">@{user.username}</span>}
        <div><span className={`tariff-badge ${tariffClass[user?.tariff || 'free']}`}>{tariffLabel[user?.tariff || 'free']}</span></div>
      </div>
      <button className="btn btn-primary btn-sm" style={{ width: 'auto', flexShrink: 0 }} onClick={handleAnketa}>
        👤 Анкета
      </button>
    </div>

    {/* Menu */}
    <div className="menu-grid">
      <button className="menu-btn" onClick={() => navigate('support')}><span className="icon">💬</span> Служба заботы</button>
      <button className="menu-btn" onClick={() => navigate('page', { slug: 'rules' })}><span className="icon">📋</span> Правила</button>
      <button className="menu-btn" onClick={() => navigate('tariffs')}><span className="icon">⭐</span> Тарифы</button>
      <button className="menu-btn" onClick={() => navigate('page', { slug: 'about' })}><span className="icon">ℹ️</span> О нас</button>
    </div>

    {/* Full-width catalog button */}
    <button className="btn btn-outline mb-16" style={{ width: '100%' }} onClick={handleCatalog}>
      🔍 Все участники
    </button>

    {/* City selector */}
    <div className="city-selector" onClick={() => setShowCityPicker(!showCityPicker)}>
      <span className="pin">📍</span><span>{cityName}</span>
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>▼</span>
    </div>
    {showCityPicker && <div style={{ marginTop: -12, marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      {cities.map(c => <div key={c.id} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: c.id === selectedCity ? 'var(--accent-soft)' : 'transparent', fontSize: 14 }}
        onClick={() => { setSelectedCity(c.id); setShowCityPicker(false); }}>{c.name} {c.id === selectedCity && '✓'}</div>)}
    </div>}

    {/* Events */}
    <div className="events-section">
      <h2>Мероприятия</h2>
      {loading && <div className="loading"><div className="spinner" /></div>}
      {!loading && events.length === 0 && <div className="empty-state"><div className="icon">📅</div><h3>Пока нет мероприятий</h3><p>Скоро здесь появятся интересные события</p></div>}
      {events.map(ev => <div key={ev.id} className="event-card" onClick={() => navigate('event', { eventId: ev.id })}>
        <div className="event-card-img">
          {ev.image_url && ev.image_url !== '/uploads/event-default.jpg'
            ? <img src={ev.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎉'}
        </div>
        <div className="event-card-body">
          <div className="event-date">{formatDate(ev.date)}</div>
          <div className="event-title">{ev.title}</div>
          <div className="event-meta">
            <span>👥 {ev.participant_count}{ev.participant_limit > 0 ? `/${ev.participant_limit}` : ''}</span>
            <span className={`event-price ${ev.is_free ? 'free' : 'paid'}`}>{ev.is_free ? 'Бесплатно' : `${ev.price} ₽`}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); navigate('event', { eventId: ev.id }); }}>Подробнее</button>
        </div>
      </div>)}
    </div>

    {/* Invite button after events */}
    <div className="gap-16" />
    <button className="btn btn-outline" style={{ width: '100%' }} onClick={handleInvite}>
      🎟 Пригласить участника на мероприятие
    </button>
  </div>;
}
