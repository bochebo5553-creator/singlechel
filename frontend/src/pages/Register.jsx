import React, { useState } from 'react';
import { api, getTelegramUser } from '../api.js';

export default function RegisterScreen({ navigate, cities, showNotice }) {
  const tgUser = getTelegramUser();
  const [form, setForm] = useState({
    full_name: `${tgUser.first_name||''} ${tgUser.last_name||''}`.trim(),
    phone:'+7', email:'', country:'Россия', city_id:1,
    consent_data:false, consent_notifications:false
  });
  const [loading, setLoading] = useState(false);
  const [policyView, setPolicyView] = useState(null);

  const update = (k,v) => setForm(f => ({...f,[k]:v}));

  async function openPage(slug) {
    try { const{page}=await api.get(`/api/pages/${slug}`); setPolicyView(page); } catch {}
  }

  async function handleRegister() {
    if (!form.full_name.trim()) { showNotice('Введите имя','error'); return; }
    if (!form.consent_data) { showNotice('Необходимо согласие на обработку данных','error'); return; }
    if (!form.consent_notifications) { showNotice('Необходимо согласие на уведомления','error'); return; }
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', {
        telegram_id: String(tgUser.id), username: tgUser.username||'',
        full_name: form.full_name.trim(), phone: form.phone||null, email: form.email||null,
        country: form.country, city_id: form.city_id,
        consent_data: true, consent_notifications: true, avatar_url: tgUser.photo_url||null
      });
      if (res.error) {
        showNotice('Ошибка: ' + res.error, 'error');
      } else if (res.status === 'approved') {
        navigate('login');
      } else {
        navigate('pending');
      }
    } catch (e) { 
      console.error('Registration error:', e);
      showNotice('Ошибка регистрации: ' + (e.message || 'сервер недоступен'), 'error'); 
    }
    setLoading(false);
  }

  if (policyView) return <div className="screen slide-up">
    <div className="screen-header"><button className="back-btn" onClick={()=>setPolicyView(null)}>←</button><h2 className="screen-title">{policyView.title}</h2></div>
    <div className="page-content" dangerouslySetInnerHTML={{__html:policyView.content}} />
    <div className="gap-16" /><button className="btn btn-secondary" onClick={()=>setPolicyView(null)}>← Назад к регистрации</button>
  </div>;

  return <div className="screen slide-up">
    <div className="logo-section"><h1>SingleChel</h1><p>Знакомства через мероприятия</p></div>
    <div className="input-group"><label className="input-label">Полное имя *</label><input className="input" value={form.full_name} onChange={e=>update('full_name',e.target.value)} placeholder="Иван Иванов" /></div>
    <div className="input-group"><label className="input-label">Телефон</label><input className="input" type="tel" value={form.phone} onChange={e=>update('phone',e.target.value)} /></div>
    <div className="input-group"><label className="input-label">Email</label><input className="input" type="email" value={form.email} onChange={e=>update('email',e.target.value)} /></div>
    <div className="input-group"><label className="input-label">Страна</label><select className="input" value={form.country} onChange={e=>update('country',e.target.value)}><option value="Россия">Россия</option></select></div>
    <div className="input-group"><label className="input-label">Город</label><select className="input" value={form.city_id} onChange={e=>update('city_id',parseInt(e.target.value))}>{cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}{cities.length===0&&<option value={1}>Челябинск</option>}</select></div>
    <div className="gap-8" />
    <label className="checkbox-row" onClick={()=>update('consent_data',!form.consent_data)}><input type="checkbox" checked={form.consent_data} readOnly /><span>Согласие на обработку <a onClick={e=>{e.stopPropagation();openPage('policy')}} style={{color:'var(--accent)',textDecoration:'underline',cursor:'pointer'}}>персональных данных</a></span></label>
    <label className="checkbox-row" onClick={()=>update('consent_notifications',!form.consent_notifications)}><input type="checkbox" checked={form.consent_notifications} readOnly /><span>Согласие на получение <a onClick={e=>{e.stopPropagation();openPage('consent_notifications')}} style={{color:'var(--accent)',textDecoration:'underline',cursor:'pointer'}}>уведомлений</a></span></label>
    <div className="gap-16" />
    <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>{loading?'Отправка...':'Отправить заявку'}</button>
    <div className="gap-16" />
    <p className="text-muted text-xs text-center">Уже есть логин и пароль?</p>
    <button className="btn btn-ghost" onClick={()=>navigate('login')}>Войти в личный кабинет</button>
  </div>;
}
