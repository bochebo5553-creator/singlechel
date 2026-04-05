import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function ProfileScreen({ user, navigate, goBack, showNotice }) {
  const [myEvents, setMyEvents] = useState([]);
  const isPaid = user?.tariff === 'tier1' || user?.tariff === 'tier2';

  useEffect(() => { if (isPaid) api.get('/api/my/events').then(d => setMyEvents(d.events || [])); }, []);

  // Free users → redirect to tariffs
  if (!isPaid) {
    return <div className="screen fade-in">
      <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Анкета</h2></div>
      <div className="empty-state">
        <div className="icon">🔒</div>
        <h3>Анкета доступна на платном тарифе</h3>
        <p className="text-muted" style={{ marginBottom: 20 }}>Оформите подписку «Уровень 1» для заполнения и просмотра анкет</p>
        <button className="btn btn-primary" style={{ maxWidth: 280, margin: '0 auto' }} onClick={() => navigate('tariffs', { suggestTier: 'tier1' })}>Выбрать тариф</button>
      </div>
    </div>;
  }

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || '?';
  const tariffLabels = { tier1: 'Уровень 1', tier2: 'Уровень 2' };

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Мой профиль</h2></div>
    <div className="profile-detail-header">
      <div className="profile-detail-avatar">
        {user?.photo_url || user?.avatar_url ? <img src={user.photo_url || user.avatar_url} alt="" />
          : <span className="avatar-placeholder">{initial}</span>}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800 }}>{user?.full_name}</h2>
      {user?.username && <p className="text-muted">@{user.username}</p>}
      <p className="text-muted text-sm" style={{ marginTop: 4 }}>Тариф: {tariffLabels[user?.tariff] || user?.tariff}</p>
    </div>
    <button className="btn btn-primary mb-16" onClick={() => navigate('profile-edit')}>✏️ Редактировать анкету</button>
    {user?.work && <div className="profile-field"><div className="profile-field-label">Работа</div><div className="profile-field-value">{user.work}</div></div>}
    {user?.interests && <div className="profile-field"><div className="profile-field-label">Интересы</div><div className="profile-field-value">{user.interests}</div></div>}
    {user?.social_links && <div className="profile-field"><div className="profile-field-label">Соцсети</div><div className="profile-field-value">{user.social_links}</div></div>}
    {user?.about && <div className="profile-field"><div className="profile-field-label">О себе</div><div className="profile-field-value">{user.about}</div></div>}
    <div className="profile-field"><div className="profile-field-label">Город</div><div className="profile-field-value">{user?.city_name || 'Не указан'}</div></div>
    <div className="profile-field"><div className="profile-field-label">Телефон</div><div className="profile-field-value">{user?.phone_visible ? (user?.phone || 'Не указан') : 'Скрыт'}</div></div>

    <div className="gap-24" />
    <div className="section-title">Мои мероприятия</div>
    {myEvents.length === 0 ? <div className="empty-state"><p>Вы пока не записаны на мероприятия</p></div>
      : myEvents.map(ev => <div key={ev.id} className="event-card" onClick={() => navigate('event', { eventId: ev.id })} style={{ marginBottom: 10 }}>
        <div className="event-card-body" style={{ padding: '12px 14px' }}>
          <div className="event-date" style={{ fontSize: 11 }}>{new Date(ev.date).toLocaleDateString('ru-RU')}</div>
          <div className="event-title" style={{ fontSize: 14 }}>{ev.title}</div>
        </div>
      </div>)}
    <div className="gap-16" />
    <button className="btn btn-secondary" onClick={() => navigate('tariffs')}>⭐ Управление тарифом</button>
  </div>;
}
