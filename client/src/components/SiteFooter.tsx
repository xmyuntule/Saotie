import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { APP_VERSION } from '../version';

function defaultCopyright(name: string, slogan: string) {
  return `© ${new Date().getFullYear()} ${name || 'SaotieSNS'} · ${slogan || '轻社交社区'}`;
}

export default function SiteFooter({ links = true, className = '' }: { links?: boolean; className?: string }) {
  const site = useSite();
  const copyright = site.copyright?.trim() || defaultCopyright(site.name, site.slogan);
  return (
    <div className={`site-footer ${className}`.trim()}>
      {links && (
        <div className="site-footer-links">
          <Link to="/changelog">更新日志</Link><span>·</span>
          <Link to="/changelog">开发计划</Link><span>·</span>
          <Link to="/changelog">问题反馈</Link><span>·</span>
          <Link to="/about">关于</Link><span>·</span><span>隐私</span>
        </div>
      )}
      <div className="site-footer-copy">
        <span>{copyright}</span>
        <span>·</span>
        <Link to="/changelog" className="num">{APP_VERSION}</Link>
      </div>
      {(site.icp || site.publicSecurity) && (
        <div className="site-footer-records">
          {site.icp && <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{site.icp}</a>}
          {site.publicSecurity && <span>{site.publicSecurity}</span>}
        </div>
      )}
      {site.footerHtml && <div className="site-footer-html" dangerouslySetInnerHTML={{ __html: site.footerHtml }} />}
    </div>
  );
}
