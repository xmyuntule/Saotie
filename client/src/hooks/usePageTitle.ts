import { useEffect } from 'react';
import { useSite } from '../context/SiteContext';

/**
 * 动态详情页（文章/问答/活动等）数据到位后，把浏览器标签标题设为真实内容标题，
 * 覆盖 Layout 按路由设的通用标题（如「文章」「活动详情」）——让标签页 / 历史 / 分享更可辨。
 * 传空（数据尚未加载或无标题）则不动，保留 Layout 的通用标题；离开页面时 Layout 按新路由重置。
 */
export function usePageTitle(title?: string | null) {
  const site = useSite();
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${site.name}`;
  }, [title, site.name]);
}
