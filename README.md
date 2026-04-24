# Meridiano

Portal de noticias global, bilingüe (ES/EN), construido sobre **exactamente** el mismo stack que `atenasseguridadprivadaltda.com`: Astro 5 + Tailwind + TypeScript + Content Collections + Decap CMS, con despliegue estático a AWS S3 + CloudFront vía GitHub Actions.

---

## Tabla de contenidos

1. [Qué incluye](#qué-incluye)
2. [Requisitos](#requisitos)
3. [Instalación local](#instalación-local)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Configurar el stack AWS para Meridiano](#configurar-el-stack-aws-para-meridiano)
6. [Desplegar la Lambda de envío de columnas](#desplegar-la-lambda-de-envío-de-columnas)
7. [GitHub Secrets requeridos](#github-secrets-requeridos)
8. [Decap CMS (panel editorial)](#decap-cms-panel-editorial)
9. [Feeds de agencias](#feeds-de-agencias)
10. [SEO e indexación en Google](#seo-e-indexación-en-google)
11. [Comandos útiles](#comandos-útiles)

---

## Qué incluye

- **Portada bilingüe** en `/` (español) y `/en/` (inglés), misma plantilla, contenido independiente.
- **Ticker de mercados en vivo** sobre el masthead (17 indicadores: índices globales, FX, cripto, commodities). Conectado a Finnhub cuando hay `PUBLIC_FINNHUB_KEY`; si no, usa datos semilla con jitter simulado.
- **Sección de wires** (AFP/AP/Reuters/EFE) con ingesta automática vía GitHub Actions cada 15 minutos.
- **Columnistas invitados** con flujo de envío → moderación → publicación (formulario → Lambda → email editorial + borrador en repo → aprobación en Decap → merge → deploy).
- **Búsqueda en sitio** con Pagefind (índice estático, cero servidor, multiidioma).
- **SEO completo**: sitemap XML, hreflang, OG, Twitter Cards, Schema.org `NewsArticle` + `NewsMediaOrganization`, RSS por idioma.
- **Newsletter** (formulario; backend lo conectas a Mailchimp/ConvertKit/SES).
- **Decap CMS** en `/admin` con workflow editorial (PRs, no push directo).

---

## Requisitos

- Node.js 20.x o superior
- npm 10.x
- Cuenta AWS con permisos para crear S3, CloudFront, Route 53, ACM, Lambda, API Gateway, SES
- Cuenta GitHub (el repo de Meridiano)
- (Opcional) SAM CLI para desplegar la Lambda: `pip install aws-sam-cli`

---

## Instalación local

```bash
# 1. Clona el repo (o descomprime este zip como punto de partida)
cd meridiano-astro

# 2. Instala dependencias
npm install

# 3. Copia variables de entorno
cp .env.example .env
# Edita .env con tus claves (PUBLIC_FINNHUB_KEY, etc.)

# 4. Arranca el servidor de desarrollo
npm run dev
# → http://localhost:4321
```

En local verás el portal con las 8 notas, 3 columnas y 4 wires de ejemplo ya publicados.

---

## Estructura del proyecto

```
meridiano-astro/
├── astro.config.mjs            # i18n (es default, en en /en/), sitemap, MDX
├── tailwind.config.mjs         # paleta editorial (ink, paper, red, gold)
├── tsconfig.json               # paths @/, @components/, @layouts/, @i18n/
├── src/
│   ├── content/
│   │   ├── config.ts           # schemas de news, opinion, wires
│   │   ├── news/               # artículos (8 de ejemplo, frontmatter + MD)
│   │   ├── opinion/            # columnas (3 aprobadas)
│   │   └── wires/              # teletipos (4 de ejemplo)
│   ├── i18n/
│   │   ├── ui.ts               # diccionario ES/EN (60+ strings)
│   │   └── utils.ts            # getLangFromUrl, useTranslations, localePath
│   ├── layouts/BaseLayout.astro # SEO + OG + Schema.org
│   ├── components/             # TopBar, Ticker, Masthead, Nav, Hero, WireSection,
│   │                           # OpinionGrid, LatestGrid, SubmitForm, Footer
│   ├── pages/
│   │   ├── index.astro         # portada ES
│   │   ├── en/index.astro      # portada EN
│   │   ├── [section]/[slug].astro  # artículo ES
│   │   ├── en/[section]/[slug].astro  # artículo EN
│   │   ├── buscar.astro        # buscador Pagefind
│   │   ├── rss.xml.ts          # feed RSS ES
│   │   └── en/rss.xml.ts       # feed RSS EN
│   └── styles/global.css       # Tailwind + custom props + animaciones
├── public/
│   └── admin/
│       ├── index.html          # carga Decap CMS
│       └── config.yml          # colecciones y campos del CMS
├── scripts/
│   └── fetch-wires.mjs         # ingesta de wires (GitHub Action)
├── lambda/
│   └── submit-column/
│       ├── index.mjs           # handler Lambda (SES + GitHub Contents API)
│       ├── package.json
│       └── template.yaml       # SAM template (HttpApi + Lambda + IAM)
└── .github/workflows/
    ├── deploy.yml              # build + pagefind + s3 sync + invalidate
    └── fetch-wires.yml         # cron */15 min
```

---

## Configurar el stack AWS para Meridiano

**Importante:** No reutilices el stack de `atenasseguridadprivadaltda.com`. Cada sitio vive en su bucket, con su distribución CloudFront y su certificado ACM propios. Replica la misma estructura que ya tienes:

1. **Registra o dirige el dominio** (ej. `meridiano.com`) a Route 53 (cambia los nameservers en Namecheap).
2. **Crea un Hosted Zone** en Route 53 para ese dominio.
3. **Solicita un certificado ACM** en `us-east-1` (CloudFront solo lee de esa región) para `meridiano.com` y `www.meridiano.com`. Valida por DNS.
4. **Crea el bucket S3** con el mismo nombre del dominio (`meridiano.com`). Bloqueo de acceso público: **activado** (servimos a través de CloudFront).
5. **Crea una distribución CloudFront**:
   - Origen: el bucket S3
   - Origin Access Control (OAC) nuevo, estilo `meridiano-s3-oac` (o reutiliza el patrón)
   - Certificado: el ACM del paso 3
   - CNAMEs: `meridiano.com` y `www.meridiano.com`
   - Default root object: `index.html`
   - Comportamiento de errores 403 → `/index.html` con código 200 (para rutas del SPA)
6. **Apunta los registros A/AAAA alias** en Route 53 a la distribución CloudFront.
7. **Crea un usuario IAM** (`meridiano-deploy`) con política restringida a:
   - `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` sobre ese bucket
   - `cloudfront:CreateInvalidation` sobre esa distribución
   Guarda el `ACCESS_KEY_ID` y `SECRET_ACCESS_KEY`.

Después actualiza los placeholders en `.github/workflows/deploy.yml`:

```yaml
env:
  S3_BUCKET: meridiano.com                     # <-- tu bucket real
  CLOUDFRONT_DISTRIBUTION_ID: EXXXXXXXXXXXX    # <-- tu distribución
  SITE_URL: https://meridiano.com              # <-- tu dominio
```

---

## Desplegar la Lambda de envío de columnas

El formulario del sitio hace POST a una Lambda que (1) valida, (2) envía un email al equipo editorial vía SES y (3) opcionalmente crea el borrador `.md` en el repo vía GitHub Contents API.

```bash
cd lambda/submit-column
npm install

# Empaqueta y despliega con SAM
sam build
sam deploy --guided
```

Durante el `sam deploy --guided` te va a pedir:

| Parámetro         | Valor de ejemplo                                    |
|-------------------|-----------------------------------------------------|
| `EditorialEmail`  | `editorial@meridiano.com`                           |
| `FromEmail`       | `no-reply@meridiano.com` (verificado en SES)        |
| `AllowedOrigin`   | `https://meridiano.com`                             |
| `GitHubToken`     | PAT con permiso `repo:contents` (opcional)          |
| `GitHubRepo`      | `coysegur-beep/meridiano`                           |

**Requisitos de SES:**
- Verificar el dominio o el `FromEmail` específico en la consola de SES.
- Si estás en Sandbox, también verificar `EditorialEmail` o pedir salida de sandbox.

Al final, SAM imprime el `ApiEndpoint`. Cópialo en tu `.env` y en los GitHub Secrets como `PUBLIC_SUBMIT_ENDPOINT`.

---

## GitHub Secrets requeridos

En `Settings → Secrets and variables → Actions` del repo:

| Secret                      | Para qué                                              |
|-----------------------------|-------------------------------------------------------|
| `AWS_ACCESS_KEY_ID`         | Credenciales del usuario `meridiano-deploy`           |
| `AWS_SECRET_ACCESS_KEY`     | Ídem                                                  |
| `PUBLIC_FINNHUB_KEY`        | Clave de Finnhub para el ticker (plan free sirve)     |
| `PUBLIC_SUBMIT_ENDPOINT`    | URL del API Gateway (salida del `sam deploy`)         |
| `AGENCY_API_KEY`            | Cuando contrates la API de AFP/AP (opcional)          |

---

## Decap CMS (panel editorial)

El panel vive en `https://tu-dominio.com/admin`. Edita `public/admin/config.yml` y cambia el campo `repo:` al repositorio real de Meridiano:

```yaml
backend:
  name: github
  repo: coysegur-beep/meridiano   # <-- cambia esto
  branch: main
```

**Autenticación (GitHub OAuth):**

Tienes dos opciones:

1. **Rápida (terceros)**: usa `https://decapbridge.com` como `base_url` (gratuito, hosteado por Sven Sauleau).
2. **Propia (AWS)**: despliega un OAuth proxy en Lambda con el template oficial de Decap (repo `decaporg/decap-cms/tree/main/packages/decap-cms-backend-github`). Es el mismo patrón que ya tienes con `atlas-deploy`.

El panel soporta:

- Flujo editorial (Editorial Workflow): cada edición abre un PR, no se publica hasta mergear.
- i18n con estructura `multiple_folders`: los archivos en `src/content/news/es/*.md` y `src/content/news/en/*.md`.
- Imágenes subidas a `public/uploads/`.

---

## Feeds de agencias

Mientras **no tengas contrato** con una agencia, el script `scripts/fetch-wires.mjs` trae feeds RSS públicos (BBC World, El Economista) como demo.

Cuando contrates (ej. AFP ForumNet o AP Media Services):

1. Añade la `AGENCY_API_KEY` a los Secrets de GitHub.
2. Reemplaza el array `FEEDS` en `scripts/fetch-wires.mjs` con los endpoints reales y ajusta el parseo según el formato (XML / NITF / JSON de la API).
3. El workflow `fetch-wires.yml` corre cada 15 minutos y commitea los `.md` nuevos. Cada commit dispara el workflow de `deploy.yml`.

---

## SEO e indexación en Google

Está todo cableado para indexación rápida:

- **Sitemap XML** en `/sitemap-index.xml` con hreflang ES/EN, regenerado en cada build.
- **RSS** en `/rss.xml` y `/en/rss.xml`.
- **Schema.org** `NewsMediaOrganization` en todas las páginas + `NewsArticle` en artículos.
- **Canonical + hreflang** calculados automáticamente.
- **Cache-Control diferenciado** por tipo de archivo (HTML 5 min, assets 1 año) para que Googlebot reciba HTML fresco sin sacrificar performance.
- **Invalidación CloudFront** en cada deploy.
- **Ping** automático al sitemap de Google y Bing al final del workflow.

**Pasos manuales después del primer deploy:**

1. Dar de alta la propiedad en **Google Search Console** (verificación por DNS en Route 53).
2. Subir `sitemap-index.xml` en la sección de sitemaps.
3. Solicitar inspección de URL para la home y 2-3 artículos representativos.
4. Ídem en **Bing Webmaster Tools**.
5. Crear perfil de editor en **Google News Publisher Center** (requiere al menos 30 días de publicación consistente y política editorial clara).

---

## Comandos útiles

```bash
# Desarrollo
npm run dev                    # http://localhost:4321

# Build de producción
npm run build                  # genera dist/

# Preview del build local
npm run preview

# Reindexar Pagefind manualmente (GitHub Action lo hace solo)
npm run pagefind

# Ingesta manual de wires
npm run fetch-wires

# Desplegar Lambda (desde lambda/submit-column)
sam build && sam deploy

# Deploy manual (si no tienes Secrets todavía):
aws s3 sync dist/ s3://meridiano.com/ --delete
aws cloudfront create-invalidation --distribution-id EXXXXXXXXXXXX --paths "/*"
```

---

## Variables de entorno

Todas las variables están en `.env.example`. Para el build de producción (GitHub Actions), se inyectan desde Secrets.

| Variable                   | Scope     | Requerida | Descripción                                          |
|----------------------------|-----------|-----------|------------------------------------------------------|
| `SITE_URL`                 | build     | sí        | Dominio final para canonical/sitemap/OG              |
| `PUBLIC_FINNHUB_KEY`       | cliente   | no        | Sin ella el ticker usa datos simulados               |
| `PUBLIC_SUBMIT_ENDPOINT`   | cliente   | sí para prod | URL del API Gateway de la Lambda                  |
| `AGENCY_API_KEY`           | Action    | no        | API de AFP/AP cuando la contrates                    |

Las variables `PUBLIC_*` se exponen al navegador (es lo normal para claves de API frontend con rate limits por origen). Las que no lleven `PUBLIC_` se quedan en el servidor.

---

## Próximos pasos sugeridos

1. **Configurar el stack AWS** de Meridiano (pasos arriba).
2. **Desplegar la Lambda** y guardar el endpoint.
3. **Añadir los 5 Secrets** al repo de GitHub.
4. **Hacer el primer push a `main`** — el workflow despliega automáticamente.
5. **Configurar Google Search Console + News Publisher Center.**
6. **Contactar a AFP, AP o EFE** para contratar el feed de agencia (cuesta entre USD 500 y 2500 mensuales según volumen y región).
7. **Dar de alta el panel `/admin`** con OAuth de GitHub y empezar a invitar a columnistas.

---

## Licencia

Proyecto privado. © 2026 Meridiano Media S.A.S.
