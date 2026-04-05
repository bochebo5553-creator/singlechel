import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function PageScreen({ navigate, goBack, screenParams }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/pages/${screenParams.slug}`).then(d => { setPage(d.page); setLoading(false); }).catch(() => setLoading(false));
  }, [screenParams.slug]);

  if (loading) return <div className="screen"><div className="loading"><div className="spinner" /></div></div>;

  return <div className="screen fade-in">
    <div className="screen-header"><button className="back-btn" onClick={goBack}>←</button><h2 className="screen-title">{page?.title || 'Страница'}</h2></div>
    <div className="page-content" dangerouslySetInnerHTML={{ __html: page?.content || '<p>Контент не найден</p>' }} />
    {screenParams.slug === 'rules' && <><div className="gap-24" /><button className="btn btn-secondary" onClick={() => navigate('support')}>💬 Служба заботы</button></>}
    <div className="gap-16" />
    <button className="btn btn-ghost" onClick={goBack}>← Назад</button>
  </div>;
}
