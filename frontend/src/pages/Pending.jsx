import React from 'react';

export default function PendingScreen() {
  return <div className="screen fade-in" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'80vh',textAlign:'center',padding:32}}>
    <div style={{fontSize:64,marginBottom:20}}>⏳</div>
    <h2 style={{fontSize:22,fontWeight:800,marginBottom:8}}>Заявка отправлена</h2>
    <p className="text-muted" style={{lineHeight:1.6,marginBottom:24,maxWidth:320}}>
      Ваша анкета отправлена на модерацию. Ожидайте ответа от администратора.
    </p>
    <p className="text-muted text-sm" style={{lineHeight:1.6,maxWidth:320}}>
      После одобрения вы получите логин и пароль для входа в приложение через Telegram-бот.
    </p>
    <div style={{marginTop:40,padding:'14px 20px',background:'var(--bg-card)',borderRadius:'var(--radius)',border:'1px solid var(--border)',maxWidth:320}}>
      <div style={{fontSize:13,color:'var(--text-secondary)'}}>💡 Подсказка</div>
      <div style={{fontSize:13,marginTop:4}}>Проверьте личные сообщения от бота — туда придут ваши данные для входа.</div>
    </div>
  </div>;
}
