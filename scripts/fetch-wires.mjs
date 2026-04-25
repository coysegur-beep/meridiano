#!/usr/bin/env node
/**
 * Ingesta de wires — corre en GitHub Actions.
 *
 * Lee feeds RSS/API públicos (o la API privada de la agencia contratada) y
 * crea archivos .md en src/content/wires/. Luego el workflow commitea y
 * dispara el deploy.
 *
 * Variables de entorno requeridas:
 *   AGENCY_API_KEY   — tu clave de AFP / AP / etc (cuando la contrates)
 *
 * Ajusta ENDPOINTS y parseo según la agencia real.
 */

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const WIRES_DIR = 'src/content/wires';
const MAX_AGE_DAYS = 3; // limpia wires viejos para no explotar el repo

// Feeds públicos como demo. En producción reemplaza con la API de tu agencia.
const FEEDS = [
  // AFP, AP y Reuters ofrecen feeds por contrato — esta es la estructura típica.
  // Mientras tanto, demos con feeds públicos:
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',            source: 'original', lang: 'en', section: 'internacional' },
  { url: 'https://www.eleconomista.es/rss/rss-economia.php',       source: 'original', lang: 'es', section: 'economia' },
];

const parser = new XMLParser({ ignoreAttributes: false });

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 80);
}

function frontmatter(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(x => JSON.stringify(x)).join(', ')}]`);
    else if (v instanceof Date) lines.push(`${k}: ${v.toISOString()}`);
    else if (typeof v === 'string') lines.push(`${k}: ${JSON.stringify(v)}`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  return lines.join('\n');
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, { headers: { 'User-Agent': 'Meridiano-Wire-Bot/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${feed.url}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item || doc?.feed?.entry || [];
  return (Array.isArray(items) ? items : [items]).slice(0, 10).map(it => ({
    title: (it.title?.['#text'] || it.title || '').toString().trim(),
    deck: (it.description || it.summary || '').toString().replace(/<[^>]+>/g, '').slice(0, 300),
    pubDate: new Date(it.pubDate || it.published || Date.now()),
    link: it.link?.['@_href'] || it.link || it.guid || '',
    source: feed.source,
    lang: feed.lang,
    section: feed.section,
  }));
}

async function cleanOld() {
  if (!existsSync(WIRES_DIR)) return;
  const files = await readdir(WIRES_DIR);
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  for (const f of files) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m && new Date(m[1]).getTime() < cutoff) {
      const { unlink } = await import('node:fs/promises');
      await unlink(join(WIRES_DIR, f));
      console.log('🗑  removed old wire:', f);
    }
  }
}

async function main() {
  await mkdir(WIRES_DIR, { recursive: true });
  await cleanOld();

  let count = 0;
  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed);
      for (const it of items) {
        if (!it.title) continue;
        const dateStr = it.pubDate.toISOString().slice(0, 10);
        const slug = slugify(it.title);
        const filename = `${dateStr}-${slug}.md`;
        const path = join(WIRES_DIR, filename);
        if (existsSync(path)) continue;

        const fm = frontmatter({
          title: it.title,
          deck: it.deck,
          pubDate: it.pubDate,
          author: it.source.toUpperCase(),
          section: it.section,
          lang: it.lang,
          source: it.source,
          externalId: it.link,
          wireTimestamp: it.pubDate.toISOString(),
          draft: false,
          featured: false,
          tags: [],
        });
        const body = `${fm}\n\n${it.deck}\n\n[Fuente original](${it.link})\n`;
        await writeFile(path, body, 'utf8');
        count++;
        console.log('📰 new wire:', filename);
      }
    } catch (err) {
      console.error('⚠️  feed failed:', feed.url, err.message);
    }
  }
  console.log(`\n✓ Done. ${count} new wires ingested.`);
}

main().catch(err => { console.error(err); process.exit(1); });
