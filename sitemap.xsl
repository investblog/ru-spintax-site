<?xml version="1.0" encoding="UTF-8"?>
<!--
  Renders /sitemap.xml as a readable page in a browser while leaving the XML
  itself untouched for crawlers. XSLT 1.0, which Chrome, Firefox and Safari all
  run natively.

  The conventions are borrowed from the casino-platform sitemap stylesheet:
  numbered rows so the count is obvious at a glance, one chip per hreflang
  alternate with the current language highlighted, and a table that collapses to
  cards on a phone. Colours are literal here rather than tokens, because this
  document is styled on its own and never loads the site stylesheet.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>Sitemap · spintax.site</title>
        <style>
          :root {
            color-scheme: dark light;
            --bg: #111111;
            --panel: #181a1f;
            --text: #e7e9ee;
            --muted: #a0a4af;
            --subtle: #8b8f98;
            --line: rgba(255,255,255,.08);
            --link: #4da3ff;
            --chip: rgba(255,255,255,.06);
            --chip-on: rgba(77,163,255,.18);
          }
          @media (prefers-color-scheme: light) {
            :root {
              --bg: #ffffff; --panel: #f7f7f8; --text: #111111; --muted: #666a73;
              --subtle: #6e7580; --line: rgba(15,23,42,.08); --link: #0055dc;
              --chip: rgba(15,23,42,.06); --chip-on: rgba(0,85,220,.12);
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0; padding: 2rem 1rem 3rem;
            background: var(--bg); color: var(--text);
            font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          .wrap { max-width: 60rem; margin-inline: auto; }
          h1 { margin: 0; font-size: 1.6rem; letter-spacing: -.02em; }
          .lead { margin: .5rem 0 1.5rem; color: var(--muted); font-size: .9rem; }
          table { width: 100%; border-collapse: collapse; font-size: .9rem; }
          th, td { text-align: left; padding: .55rem .6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
          th { color: var(--subtle); font-weight: 600; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
          tr:hover td { background: var(--panel); }
          .num { color: var(--subtle); width: 3rem; font-variant-numeric: tabular-nums; }
          .mod { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
          a { color: var(--link); text-decoration: none; overflow-wrap: anywhere; }
          a:hover { text-decoration: underline; }
          .lang { display: inline-block; margin: 0 .25rem .25rem 0; padding: .1rem .4rem;
                  background: var(--chip); border-radius: 4px; font-size: .7rem; color: var(--muted); }
          .lang.current { background: var(--chip-on); color: var(--text); }
          footer { margin-top: 2rem; color: var(--subtle); font-size: .8rem; }
          @media (max-width: 37.5rem) {
            thead { display: none; }
            tr { display: block; padding: .6rem 0; border-bottom: 1px solid var(--line); }
            td { display: block; border: 0; padding: .1rem 0; }
            .num { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Sitemap</h1>
          <p class="lead">
            <xsl:value-of select="count(s:urlset/s:url)"/>
            <xsl:text> URLs. This page is the sitemap itself, rendered for people; crawlers read the XML underneath.</xsl:text>
          </p>

          <table>
            <thead>
              <tr>
                <th class="num">#</th>
                <th>URL</th>
                <th>Last modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td class="num"><xsl:value-of select="position()"/></td>
                  <td>
                    <a href="{s:loc}"><xsl:value-of select="s:loc"/></a>
                    <xsl:if test="xhtml:link[@rel='alternate']">
                      <div>
                        <xsl:for-each select="xhtml:link[@rel='alternate'][@hreflang!='x-default']">
                          <xsl:choose>
                            <xsl:when test="@href = current()/../s:loc">
                              <span class="lang current"><xsl:value-of select="@hreflang"/></span>
                            </xsl:when>
                            <xsl:otherwise>
                              <span class="lang"><xsl:value-of select="@hreflang"/></span>
                            </xsl:otherwise>
                          </xsl:choose>
                        </xsl:for-each>
                      </div>
                    </xsl:if>
                  </td>
                  <td class="mod"><xsl:value-of select="s:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <footer>
            <a href="/">spintax.site</a>, a <a href="https://spintax.net">spintax.net</a> project.
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
