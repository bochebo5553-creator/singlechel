import React, { useState, useEffect } from 'react';
import { api, formatDate } from '../api.js';

export default function InviteScreen({ user, goBack, screenParams, showNotice }) {
  const { targetUserId, targetUserName, targetCityId } = screenParams;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  useEffect(() => {
    api.get(`/api/events?city_id=${targetCityId || 1}`).then(d => { setEvents(d.events || []); setLoading(false); }).catch(() => setLoading(false));
  }, [targetCityId]);

  async function handleInvite(ev) {
    setSending(ev.id);
    try {
      const res = await api.post('/api/invite', { target_user_id: targetUserId, event_id: ev.id });
      if (res.success) showNotice(`Приглашение отправлено ${targetUserName}!`, 'success');
      else showNotice(res.error || 'Ошибка отправки', 'error');
    } catch { showNotice('Ошибка отправки приглашения', 'error'); }
    setSending(null);
  }

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Пригласить</h2></div>
    <div style={{ padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
      Выберите мероприятие, на которое хотите пригласить <strong>{targetUserName}</strong>
    </div>
    {loading && <div className="loading"><div className="spinner" /></div>}
    {!loading && events.length === 0 && <div className="empty-state"><h3>Нет мероприятий в этом городе</h3></div>}
    {events.map(ev => <div key={ev.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }}>
      <div className="card-body" style={{ padding: '14px' }}>
        <div className="event-date" style={{ fontSize: 11 }}>{formatDate(ev.date)}</div>
        <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0 8px' }}>{ev.title}</div>
        <div className="event-meta" style={{ marginBottom: 10 }}>
          <span>👥 {ev.participant_count}{ev.participant_limit > 0 ? `/${ev.participant_limit}` : ''}</span>
          <span className={`event-price ${ev.is_free ? 'free' : 'paid'}`}>{ev.is_free ? 'Бесплатно' : `${ev.price} ₽`}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => handleInvite(ev)} disabled={sending === ev.id}>
          {sending === ev.id ? 'Отправка...' : `📨 Пригласить ${targetUserName?.split(' ')[0]}`}
        </button>
      </div>
    </div>)}
    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
  </div>;
}
