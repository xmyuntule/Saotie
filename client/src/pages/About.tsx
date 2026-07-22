import { useEffect } from 'react';

export default function About() {
  useEffect(() => {
    if (window.location.hostname === 'saotie.com') {
      window.location.replace('https://www.saotie.com/about');
    }
  }, []);

  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
      <div>
        <h1>关于 SaotieSNS</h1>
        <p className="muted">官网页面正在加载。</p>
        <a className="btn btn-primary" href="https://www.saotie.com/about">打开官网关于页面</a>
      </div>
    </main>
  );
}
