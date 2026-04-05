import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function TariffsScreen({ user, navigate, goBack, screenParams }) {
  const [tariffs, setTariffs] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const suggestTier = screenParams?.suggestTier;

  useEffect(() => {
    api.get('/api/tariffs').then(d => { setTariffs(d.tariffs || []); setLoading(false); });
  }, []);

  if (loading) return <div className="screen"><div className="loading"><div className="spinner" /></div></div>;

  return <div className="screen fade-in">
    <div className="screen-header">
      <button className="back-btn" onClick={goBack}>←</button>
      <h2 className="screen-title">Тарифы</h2>
    </div>

    {suggestTier && <div style={{ padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
      💡 {suggestTier === 'tier1' ? 'Для доступа к этой функции выберите тариф «Уровень 1» или выше' : 'Для доступа к этой функции выберите тариф «Уровень 2»'}
    </div>}

    <div className="period-selector">
      <button className={`period-btn ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>Месяц</button>
      <button className={`period-btn ${period === 'yearly' ? 'active' : ''}`} onClick={() => setPeriod('yearly')}>Год <span style={{ fontSize: 11 }}>-15%</span></button>
    </div>

    {tariffs.map((t, i) => {
      const price = period === 'yearly' ? t.price_yearly : t.price_monthly;
      const isCurrent = user?.tariff === t.tier;
      const isSuggested = suggestTier === t.tier;

      return <div key={t.id} className={`tariff-card ${isCurrent ? 'active' : ''} ${isSuggested ? 'popular' : ''}`}>
        {isCurrent && <div className="tariff-badge-popular" style={{ background: 'var(--success)' }}>Текущий</div>}
        {isSuggested && !isCurrent && <div className="tariff-badge-popular">Рекомендуем</div>}
        <div className="tariff-name">{t.name}</div>
        <div className="tariff-price">
          {price === 0 ? 'Бесплатно' : <>{price} ₽ <span>/ {period === 'yearly' ? 'год' : 'мес'}</span></>}
        </div>
        {period === 'yearly' && price > 0 && <div className="tariff-yearly">{Math.round(price / 12)} ₽/мес • экономия 15%</div>}
        <ul className="tariff-features">
          {(t.features || []).map((f, fi) => <li key={fi}>{f}</li>)}
        </ul>
        {isCurrent ? <button className="btn btn-secondary btn-sm" disabled>✓ Текущий тариф</button>
          : price === 0 ? null
          : <button className="btn btn-primary btn-sm" onClick={() => navigate('payment', { type: 'tariff', tier: t.tier, tierName: t.name, period, price })}>Перейти на тариф</button>}
      </div>;
    })}
    <p className="text-muted text-xs text-center mt-16">Оплата тарифа производится онлайн</p>
  </div>;
}
