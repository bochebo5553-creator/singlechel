import React, { useState, useEffect, useCallback } from 'react';
import { api, getTelegramUser, initTelegram } from './api.js';
import RegisterScreen from './pages/Register.jsx';
import LoginScreen from './pages/Login.jsx';
import PendingScreen from './pages/Pending.jsx';
import MainScreen from './pages/Main.jsx';
import EventScreen from './pages/Event.jsx';
import TariffsScreen from './pages/Tariffs.jsx';
import PaymentScreen from './pages/Payment.jsx';
import ProfileScreen from './pages/Profile.jsx';
import ProfileEditScreen from './pages/ProfileEdit.jsx';
import UserProfileScreen from './pages/UserProfile.jsx';
import CatalogScreen from './pages/Catalog.jsx';
import PageScreen from './pages/PageView.jsx';
import SupportScreen from './pages/Support.jsx';
import InviteScreen from './pages/Invite.jsx';

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser] = useState(null);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(1);
  const [screenParams, setScreenParams] = useState({});
  const [history, setHistory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('sc_token') || '');

  const showNotice = useCallback((text, type='info') => {
    setNotification({text,type});
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const navigate = useCallback((s, params={}) => {
    setHistory(h => [...h, {screen, params:screenParams}]);
    setScreen(s); setScreenParams(params); window.scrollTo(0,0);
  }, [screen, screenParams]);

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length-1];
      setHistory(h => h.slice(0,-1));
      setScreen(prev.screen); setScreenParams(prev.params);
    } else { setScreen('main'); setScreenParams({}); }
  }, [history]);

  // Store token for API calls
  useEffect(() => {
    if (authToken) {
      localStorage.setItem('sc_token', authToken);
      window.__SC_TOKEN = authToken;
    }
  }, [authToken]);

  useEffect(() => {
    initTelegram();
    const tg = window.Telegram?.WebApp;
    if (tg) tg.BackButton.onClick(() => goBack());
    checkAuth();
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (!['main','loading','register','login','pending'].includes(screen)) tg.BackButton.show();
      else tg.BackButton.hide();
    }
  }, [screen]);

  async function checkAuth() {
    try {
      const citiesData = await api.get('/api/cities');
      setCities(citiesData.cities || []);
    } catch {}

    // If we have a saved token, try to login with it
    if (authToken) {
      try {
        const data = await api.get('/api/auth/me');
        if (data.user) {
          setUser(data.user);
          setSelectedCity(data.user.city_id || 1);
          setScreen('main');
          return;
        }
      } catch {}
    }

    // Check Telegram user status — only auto-enter if first login was already done
    try {
      const statusData = await api.get('/api/auth/status');
      if (statusData.status === 'approved' && statusData.firstLoginDone) {
        // Already completed first login — enter app directly
        const meData = await api.get('/api/auth/me');
        if (meData.user) {
          setUser(meData.user);
          setSelectedCity(meData.user.city_id || 1);
          if (meData.user.login) setAuthToken(meData.user.login);
          setScreen('main');
          return;
        }
      }
      if (statusData.status === 'approved' && !statusData.firstLoginDone) {
        // Approved but hasn't entered login/password yet — must do it once
        setScreen('login');
      } else if (statusData.status === 'pending') {
        setScreen('pending');
      } else {
        setScreen('register');
      }
    } catch {
      setScreen('register');
    }
  }

  function handleLogin(userData, token) {
    setAuthToken(token);
    setUser(userData);
    setSelectedCity(userData.city_id || 1);
    setScreen('main');
    showNotice('Добро пожаловать!', 'success');
  }

  function handleLogout() {
    setAuthToken('');
    localStorage.removeItem('sc_token');
    window.__SC_TOKEN = '';
    setUser(null);
    setScreen('login');
  }

  function refreshUser() {
    api.get('/api/auth/me').then(d => { if (d.user) setUser(d.user); });
  }

  const props = { user, setUser, navigate, goBack, cities, selectedCity, setSelectedCity, screenParams, refreshUser, showNotice, handleLogout };

  if (screen === 'loading') return <div className="screen" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
    <div style={{textAlign:'center'}}><div className="spinner" style={{margin:'0 auto 16px'}}></div><p className="text-muted">Загрузка...</p></div></div>;

  return <>
    {notification && <div style={{position:'fixed',top:12,left:'50%',transform:'translateX(-50%)',zIndex:999,padding:'10px 20px',borderRadius:10,fontWeight:700,fontSize:13,fontFamily:'var(--font)',animation:'fadeIn 0.3s',background:notification.type==='error'?'#ff5e7a':notification.type==='success'?'#34d399':'#60a5fa',color:'white',maxWidth:'90%',textAlign:'center'}}>{notification.text}</div>}
    {screen === 'register' && <RegisterScreen {...props} />}
    {screen === 'login' && <LoginScreen {...props} onLogin={handleLogin} />}
    {screen === 'pending' && <PendingScreen {...props} />}
    {screen === 'main' && <MainScreen {...props} />}
    {screen === 'event' && <EventScreen {...props} />}
    {screen === 'tariffs' && <TariffsScreen {...props} />}
    {screen === 'payment' && <PaymentScreen {...props} />}
    {screen === 'profile' && <ProfileScreen {...props} />}
    {screen === 'profile-edit' && <ProfileEditScreen {...props} />}
    {screen === 'user-profile' && <UserProfileScreen {...props} />}
    {screen === 'catalog' && <CatalogScreen {...props} />}
    {screen === 'page' && <PageScreen {...props} />}
    {screen === 'support' && <SupportScreen {...props} />}
    {screen === 'invite' && <InviteScreen {...props} />}
  </>;
}
