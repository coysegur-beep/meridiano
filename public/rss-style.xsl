<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>RSS — Meridiano</title>
        <style>
          body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #0A0A0A; background: #F5F1E8; }
          h1 { font-size: 2rem; border-bottom: 2px solid #0A0A0A; padding-bottom: 12px; }
          .item { border-bottom: 1px solid #ccc; padding: 20px 0; }
          .item h2 { margin: 0 0 8px; font-size: 1.2rem; }
          .item a { color: #C8102E; text-decoration: none; }
          .item a:hover { text-decoration: underline; }
          .meta { font-size: 0.85rem; color: #666; font-family: sans-serif; }
        </style>
      </head>
      <body>
        <h1>📰 Meridiano — Feed RSS</h1>
        <p class="meta">Suscríbete copiando esta URL en tu lector de RSS.</p>
        <xsl:for-each select="rss/channel/item">
          <div class="item">
            <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
            <p><xsl:value-of select="description"/></p>
            <p class="meta"><xsl:value-of select="pubDate"/> · <xsl:value-of select="author"/></p>
          </div>
        </xsl:for-each>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
