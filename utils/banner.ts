/**
 * utils/banner.ts — "Powered by Drop Deploy" bottom bar for free tier deploys.
 * Bigger and more visible than the small pill watermark.
 * Paid plans get the small pill watermark from watermark.ts instead.
 */

const BANNER_CSS = `
#__dd_banner{
  position:fixed;bottom:0;left:0;right:0;z-index:2147483647;
  display:flex;align-items:center;justify-content:center;gap:8px;
  padding:8px 16px;
  background:rgba(9,9,11,0.92);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-top:1px solid rgba(255,255,255,0.08);
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:12px;font-weight:500;
  color:rgba(255,255,255,0.7);
  letter-spacing:-0.01em;
}
#__dd_banner a{
  color:#fff;font-weight:700;text-decoration:none;
  display:inline-flex;align-items:center;gap:5px;
}
#__dd_banner a:hover{text-decoration:underline;}
`.trim()

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="14" height="14" aria-hidden="true" style="display:block;flex-shrink:0"><g transform="translate(4,4)"><line x1="16" y1="4" x2="10" y2="20" stroke="#fff" stroke-width="3" stroke-linecap="square" fill="none"/><line x1="10" y1="4" x2="4" y2="20" stroke="#fff" stroke-width="3" stroke-linecap="square" fill="none"/><rect x="18" y="16" width="4" height="4" fill="#fff" stroke="none"/></g></svg>`

export function injectFreeBanner(html: string, homeUrl: string): string {
  const banner = `\n<style id="__dd_bs">${BANNER_CSS}</style>\n<div id="__dd_banner">Hosted with <a href="${homeUrl}" target="_blank" rel="noopener noreferrer">${LOGO_SVG}Drop Deploy</a> &nbsp;·&nbsp; <a href="${homeUrl}/en#pricing" target="_blank" rel="noopener noreferrer">Upgrade for permanent links</a></div>`

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${banner}\n</body>`)
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${banner}\n</html>`)
  }
  return html + banner
}
