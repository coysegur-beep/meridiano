/**
 * Lambda: submit-column
 *
 * Recibe el POST del formulario del portal. Valida, envía un email al
 * equipo editorial vía SES, y opcionalmente abre un Pull Request con la
 * columna como .md en src/content/opinion/ (pendiente de aprobación).
 *
 * Variables de entorno:
 *   EDITORIAL_EMAIL     — destinatario (ej. editorial@meridiano.example)
 *   FROM_EMAIL          — remitente verificado en SES
 *   GITHUB_TOKEN        — PAT con permiso repo:contents (opcional)
 *   GITHUB_REPO         — owner/repo (ej. coysegur-beep/meridiano)
 *   ALLOWED_ORIGIN      — dominio del sitio para CORS
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});

const ok = (body, origin) => ({
  statusCode: 200,
  headers: corsHeaders(origin),
  body: JSON.stringify(body),
});
const bad = (msg, origin, code = 400) => ({
  statusCode: code,
  headers: corsHeaders(origin),
  body: JSON.stringify({ error: msg }),
});

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;

  // CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  let data;
  try { data = JSON.parse(event.body || '{}'); }
  catch { return bad('JSON inválido', origin); }

  // Honeypot
  if (data.website) return ok({ ok: true, spam: true }, origin);

  const { name, email, title, section, bio, body, lang = 'es' } = data;
  if (!name || !email || !title || !section || !bio || !body) {
    return bad('Faltan campos obligatorios', origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Email inválido', origin);
  const words = String(body).trim().split(/\s+/).filter(Boolean).length;
  if (words < 200 || words > 2000) return bad('Longitud fuera de rango', origin);

  // 1. Email al equipo editorial
  const subject = `[Columna propuesta] ${title} — ${name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto;">
      <h2 style="color:#C8102E; border-bottom: 2px solid #0A0A0A; padding-bottom: 8px;">Nueva columna propuesta</h2>
      <p><strong>Autor:</strong> ${escapeHtml(name)}<br>
      <strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br>
      <strong>Sección:</strong> ${escapeHtml(section)} (${lang})<br>
      <strong>Palabras:</strong> ${words}</p>
      <p><strong>Bio:</strong> ${escapeHtml(bio)}</p>
      <h3 style="color:#0A0A0A;">${escapeHtml(title)}</h3>
      <div style="border-left: 3px solid #B8934F; padding-left: 16px; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(body)}</div>
      <hr style="margin: 24px 0;">
      <p style="color:#666; font-size: 12px;">Para aprobar: abre /admin en el portal, busca el borrador en "Opinión" y marca <em>Aprobada = true</em>. El deploy es automático al mergear.</p>
    </div>`;

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: process.env.FROM_EMAIL,
      Destination: { ToAddresses: [process.env.EDITORIAL_EMAIL] },
      ReplyToAddresses: [email],
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      },
    }));
  } catch (err) {
    console.error('SES error:', err);
    return bad('No se pudo enviar la notificación', origin, 500);
  }

  // 2. Opcionalmente: crear archivo .md como borrador en el repo (abre PR)
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    try {
      const slug = `${new Date().toISOString().slice(0,10)}-${slugify(title)}`;
      const path = `src/content/opinion/${slug}.md`;
      const fm = [
        '---',
        `title: ${JSON.stringify(title)}`,
        `deck: ""`,
        `pubDate: ${new Date().toISOString()}`,
        `submittedAt: ${new Date().toISOString()}`,
        `author: ${JSON.stringify(name)}`,
        `authorBio: ${JSON.stringify(bio)}`,
        `section: opinion`,
        `lang: ${lang}`,
        `approved: false`,
        `draft: true`,
        `source: original`,
        `tags: []`,
        '---',
        '',
        body,
      ].join('\n');

      const content = Buffer.from(fm).toString('base64');
      const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `feat(opinion): columna propuesta por ${name}`,
          content,
          branch: 'main',
        }),
      });
      if (!res.ok) console.error('GitHub commit failed:', await res.text());
    } catch (err) {
      console.error('GitHub error:', err);
      // no fallar la request por esto
    }
  }

  return ok({ ok: true }, origin);
};
