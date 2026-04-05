import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function UserProfileScreen({ user, navigate, goBack, screenParams, showNotice }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/users/${screenParams.userId}`).then(d => { setProfile(d.user); setLoading(false); }).catch(() => setLoading(false));
  }, [screenParams.userId]);

  if (loading) return <div className="screen"><div className="loading"><div className="spinner" /></div></div>;

  // Access control: free users can't view profiles
  const isPaid = user?.tariff === 'tier1' || user?.tariff === 'tier2';
  if (!isPaid) {
    return <div className="screen fade-in">
      <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Профиль</h2></div>
      <div className="empty-state">
        <div className="icon">🔒</div>
        <h3>Просмотр профилей доступен на платном тарифе</h3>
        <p className="text-muted" style={{ marginBottom: 20 }}>Оформите подписку «Уровень 1» или выше</p>
        <button className="btn btn-primary" style={{ maxWidth: 280, margin: '0 auto' }} onClick={() => navigate('tariffs', { suggestTier: 'tier1' })}>Выбрать тариф</button>
      </div>
    </div>;
  }

  if (!profile) return <div className="screen">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Профиль</h2></div>
    <div className="empty-state"><h3>Профиль не найден</h3></div>
  </div>;

  const initial = profile.full_name?.charAt(0)?.toUpperCase() || '?';
  const canInvite = user?.tariff === 'tier2';

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Профиль участника</h2></div>
    <div className="profile-detail-header">
      <div className="profile-detail-avatar">
        {profile.photo_url || profile.avatar_url ? <img src={profile.photo_url || profile.avatar_url} alt="" /> : <span className="avatar-placeholder">{initial}</span>}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800 }}>{profile.full_name}</h2>
      {profile.username && <p className="text-muted">@{profile.username}</p>}
    </div>
    {profile.work && <div className="profile-field"><div className="profile-field-label">Работа</div><div className="profile-field-value">{profile.work}</div></div>}
    {profile.interests && <div className="profile-field"><div className="profile-field-label">Интересы</div><div className="profile-field-value">{profile.interests}</div></div>}
    {profile.social_links && <div className="profile-field"><div className="profile-field-label">Соцсети</div><div className="profile-field-value">{profile.social_links}</div></div>}
    {profile.about && <div className="profile-field"><div className="profile-field-label">О себе</div><div className="profile-field-value">{profile.about}</div></div>}
    {profile.phone && <div className="profile-field"><div className="profile-field-label">Телефон</div><div className="profile-field-value">{profile.phone}</div></div>}

    {/* Invite button — only for tier2 */}
    {canInvite && <div className="gap-24" />}
    {canInvite && <button className="btn btn-primary" onClick={() => navigate('invite', { targetUserId: profile.id, targetUserName: profile.full_name, targetCityId: profile.city_id })}>
      🎟 Пригласить на мероприятие
    </button>}

    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
  </div>;
}
