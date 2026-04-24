import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const news = await getCollection('news', ({ data }) => !data.draft && data.lang === 'es');
  const opinion = await getCollection('opinion', ({ data }) => !data.draft && data.approved && data.lang === 'es');

  const items = [...news, ...opinion]
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
    .slice(0, 50);

  return rss({
    title: 'Meridiano — Noticias sin fronteras',
    description: 'Periodismo independiente, global y riguroso.',
    site: context.site!,
    items: items.map(item => ({
      title: item.data.title,
      pubDate: item.data.pubDate,
      description: item.data.deck || '',
      link: `/${item.data.section}/${item.id.replace(/\.(md|mdx)$/, '')}`,
      author: item.data.author,
      categories: [item.data.section, ...item.data.tags],
    })),
    customData: '<language>es-CO</language>',
    stylesheet: '/rss-style.xsl',
  });
}
