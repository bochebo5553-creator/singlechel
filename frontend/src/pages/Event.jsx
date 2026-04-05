import React, { useState, useEffect } from 'react';
import { api, formatDate } from '../api.js';

export default function EventScreen({ user, navigate, goBack, screenParams, showNotice }) {
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadEvent(); }, [screenParams.eventId]);

  async function loadEvent() {
    setLoading(true);
    try {
      const data = await api.get(`/api/events/${screenParams.eventId}`);
      setEvent(data.event);
      setParticipants(data.participants || []);
      setJoined(!!data.participants?.some(p => p.id === user?.id));
    } catch {}
    setLoading(false);
  }

  async function handleJoin() {
    if (!event) return;
    if (joined) { showNotice('Вы уже записаны на это мероприятие', 'info'); return; }
    // Paid event → payment
    if (!event.is_free && event.price > 0) {
      navigate('payment', { type: 'event', eventId: event.id, eventTitle: event.title, price: event.price });
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/api/events/${screenParams.eventId}/join`);
      if (res.error) { showNotice(res.error, 'error'); }
      else { setJoined(true); showNotice('Вы записаны!', 'success'); loadEvent(); }
    } catch { showNotice('Ошибка записи', 'error'); }
    setActionLoading(false);
  }

  async function handleLeave() {
    setActionLoading(true);
    try {
      await api.post(`/api/events/${screenParams.eventId}/leave`);
      setJoined(false);
      showNotice('Участие отменено', 'info');
      loadEvent();
    } catch { showNotice('Ошибка', 'error'); }
    setActionLoading(false);
  }

  function handleViewProfile(participantId) {
    const isPaid = user?.tariff === 'tier1' || user?.tariff === 'tier2';
    if (!isPaid) {
      showNotice('Просмотр профилей доступен на платном тарифе', 'info');
      navigate('tariffs', { suggestTier: 'tier1' });
    } else {
      navigate('user-profile', { userId: participantId });
    }
  }

  if (loading) return <div className="screen"><div className="loading"><div className="spinner" /></div></div>;
  if (!event) return <div className="screen"><div className="screen-header"><button className="back-btn" onClick={goBack}>←</button></div><div className="empty-state"><h3>Мероприятие не найдено</h3></div></div>;

  const isFull = event.participant_limit > 0 && (event.participant_count || 0) >= event.participant_limit;

  return <div className="screen fade-in">
    <div className="event-hero">
      {event.image_url && event.image_url !== '/uploads/event-default.jpg'
        ? <img src={event.image_url} alt="" /> : '🎉'}
    </div>
    <div className="screen-header" style={{ paddingTop: 16 }}>
      <button className="back-btn" onClick={goBack}>←</button>
      <h2 className="screen-title" style={{ flex: 1 }}>{event.title}</h2>
    </div>

    {/* Status badge if joined */}
    {joined && <div style={{ padding: '10px 14px', background: 'rgba(52,211,153,0.12)', borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14 }}>✓ Вы записаны на это мероприятие</span>
    </div>}

    <div className="event-detail-header">
      <div className="event-date">{formatDate(event.date)}</div>
    </div>

    {event.address && <div className="event-info-row">
      <span className="icon">📍</span>
      <div>
        <div>{event.address}</div>
        {event.map_link && <a href={event.map_link} target="_blank" rel="noreferrer">Открыть на карте →</a>}
      </div>
    </div>}

    <div className="event-info-row">
      <span className="icon">💰</span>
      <div>{event.is_free
        ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>Бесплатно</span>
        : <div><span style={{ fontWeight: 700 }}>{event.price} ₽</span><span className="text-muted text-sm" style={{ marginLeft: 8 }}>(онлайн {Math.round(event.price * 0.85)} ₽, скидка 15%)</span></div>}
      </div>
    </div>

    <div className="event-info-row">
      <span className="icon">👥</span>
      <div>{event.participant_count || 0} участник(ов){event.participant_limit > 0 && <span className="text-muted"> / {event.participant_limit} мест</span>}</div>
    </div>

    {event.description && <><div className="gap-16" /><div className="page-content">{event.description}</div></>}

    {/* Participants */}
    {participants.length > 0 && <>
      <div className="gap-16" />
      <div className="section-title">Участники</div>
      <div className="participants-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {participants.slice(0, 8).map(p => (
          <div key={p.id} className="participant-avatar" title={p.full_name}
            onClick={() => handleViewProfile(p.id)}>
            {p.photo_url || p.avatar_url ? <img src={p.photo_url || p.avatar_url} alt="" />
              : p.full_name?.charAt(0)?.toUpperCase()}
          </div>
        ))}
        {participants.length > 8 && <div className="participant-avatar participant-more">+{participants.length - 8}</div>}
      </div>
    </>}

    <div className="gap-24" />

    {/* Action buttons — different states */}
    {!joined ? (
      <button className="btn btn-primary" onClick={handleJoin} disabled={actionLoading || isFull}>
        {isFull ? '😔 Все места заняты' : actionLoading ? 'Запись...'
          : event.is_free ? '🎟 Участвовать' : `🎟 Участвовать • ${event.price} ₽`}
      </button>
    ) : (
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleLeave} disabled={actionLoading}>
          {actionLoading ? '...' : '✕ Отменить участие'}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={goBack}>
          ← К мероприятиям
        </button>
      </div>
    )}

    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={() => navigate('support')} style={{ fontSize: 13 }}>
      💬 Служба заботы
      <span className="text-muted" style={{ marginLeft: 6, fontSize: 11 }}>Уточнение информации о мероприятии</span>
    </button>
  </div>;
}
