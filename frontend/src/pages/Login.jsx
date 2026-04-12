import React, { useState } from 'react';
import { api } from '../api.js';

export default function LoginScreen({ navigate, onLogin, showNotice }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!login.trim() || !password.trim()) { showNotice('Введите логин и пароль','error'); return; }
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { login: login.trim(), password: password.trim() });
      if (res.error) { showNotice(res.error,'error'); }
      else if (res.user) { onLogin(res.user, res.token); }
    } catch { showNotice('Ошибка подключения','error'); }
    setLoading(false);
  }

  return <div className="screen fade-in" style={{display:'flex',flexDirection:'column',justifyContent:'center',minHeight:'85vh'}}>
    <div className="logo-section"><h1>SingleChel</h1><p>Вход в личный кабинет</p></div>

    <div className="input-group">
      <label className="input-label">Логин</label>
      <input className="input" value={login} onChange={e=>setLogin(e.target.value)} placeholder="Ваш логин" autoComplete="username" />
    </div>

    <div className="input-group">
      <label className="input-label">Пароль</label>
      <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Ваш пароль"
        onKeyDown={e=>e.key==='Enter'&&handleLogin()} autoComplete="current-password" />
    </div>

    <div className="gap-8" />
    <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
      {loading ? 'Вход...' : 'Войти'}
    </button>

    <div className="gap-24" />
    <p className="text-muted text-xs text-center">Нет аккаунта?</p>
    <button className="btn btn-ghost" onClick={()=>navigate('register')}>Подать заявку на регистрацию</button>

    <div style={{marginTop:24,padding:'12px 16px',background:'var(--bg-card)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
      <div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.5}}>
        💡 Логин и пароль вы получите от администратора в Telegram после прохождения модерации.
      </div>
    </div>
  </div>;
}
