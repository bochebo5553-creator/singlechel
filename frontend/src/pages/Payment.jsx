import React, { useState } from 'react';
import { api } from '../api.js';

export default function PaymentScreen({ navigate, goBack, screenParams, refreshUser, showNotice }) {
  const { type, tier, tierName, period, price, eventId, eventTitle } = screenParams;
  const isTariff = type === 'tariff';
  const [method, setMethod] = useState('online');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const onlinePrice = isTariff ? price : Math.round(price * 0.85);

  async function handlePay() {
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1500));
    try {
      if (isTariff) { await api.post('/api/payment', { tier, period }); refreshUser(); }
      else { await api.post(`/api/events/${eventId}/join`, { payment_method: method }); }
      setDone(true);
      showNotice(isTariff ? 'Тариф активирован!' : 'Вы записаны!', 'success');
    } catch { showNotice('Ошибка оплаты', 'error'); }
    setProcessing(false);
  }

  if (done) return <div className="screen fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
    <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
    <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{isTariff ? 'Тариф активирован!' : 'Вы записаны!'}</h2>
    <p className="text-muted" style={{ marginBottom: 24 }}>
      {isTariff ? `Тариф «${tierName}» активирован` : method === 'online' ? `Оплата за «${eventTitle}» прошла` : `Вы записаны на «${eventTitle}». Оплата на месте: ${price} ₽`}
    </p>
    <button className="btn btn-primary" onClick={() => navigate('main')}>На главную</button>
  </div>;

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Оплата</h2></div>
    <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 20 }}>
      {isTariff ? <><div className="text-muted text-sm mb-8">Тариф</div><div style={{ fontSize: 18, fontWeight: 700 }}>{tierName}</div><div className="text-muted text-sm mt-8">Период: {period === 'yearly' ? '1 год' : '1 месяц'}</div></>
        : <><div className="text-muted text-sm mb-8">Мероприятие</div><div style={{ fontSize: 18, fontWeight: 700 }}>{eventTitle}</div></>}
    </div>
    <div className="section-title">Способ оплаты</div>
    <div className={`payment-option ${method === 'online' ? 'selected' : ''}`} onClick={() => setMethod('online')}>
      <div><div style={{ fontWeight: 700, fontSize: 15 }}>⚡ Онлайн (СБП)</div><div className="text-muted text-xs">{isTariff ? 'Быстрый платёж' : 'Оплата сейчас со скидкой'}</div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isTariff ? <span style={{ fontWeight: 700, fontSize: 16 }}>{price} ₽</span>
          : <><span style={{ fontWeight: 700, fontSize: 16 }}>{onlinePrice} ₽</span><span className="payment-discount">-15%</span></>}
      </div>
    </div>
    {!isTariff && <div className={`payment-option ${method === 'onsite' ? 'selected' : ''}`} onClick={() => setMethod('onsite')}>
      <div><div style={{ fontWeight: 700, fontSize: 15 }}>🏠 На месте</div><div className="text-muted text-xs">Оплата в день мероприятия</div></div>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{price} ₽</span>
    </div>}
    <div className="gap-24" />
    <div style={{ textAlign: 'center', padding: 12, background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{method === 'online' ? (isTariff ? price : onlinePrice) : price} ₽</div>
      <div className="text-muted text-sm">{method === 'onsite' ? 'Оплата на месте' : 'Итого к оплате'}</div>
    </div>
    <button className="btn btn-primary" onClick={handlePay} disabled={processing}>{processing ? 'Обработка...' : method === 'onsite' ? 'Записаться (оплата на месте)' : 'Оплатить'}</button>
    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
    <p className="text-muted text-xs text-center mt-16">* MVP: оплата симулирована</p>
  </div>;
}
