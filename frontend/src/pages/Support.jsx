import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function SupportScreen({ goBack }) {
  const [page, setPage] = useState(null);
  useEffect(() => { api.get('/api/pages/support').then(d => setPage(d.page)).catch(() => {}); }, []);
  const supportLink = 'https://t.me/singlechel_support';

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">Служба заботы</h2></div>
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>💬</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Мы здесь, чтобы помочь</h3>
      <p className="text-muted" style={{ marginBottom: 24, lineHeight: 1.6 }}>Если у вас есть вопросы, проблемы или предложения — напишите нам в Telegram</p>
    </div>
    {page?.content && <div className="page-content" style={{ marginBottom: 24 }} dangerouslySetInnerHTML={{ __html: page.content }} />}
    <a href={supportLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>✉️ Написать в поддержку</a>
    <p className="text-muted text-xs text-center mt-16">Обычно отвечаем в течение 24 часов</p>
    <div className="gap-8" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
  </div>;
}
