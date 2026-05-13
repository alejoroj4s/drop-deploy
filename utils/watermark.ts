/**
 * Injects a "deployed on dropdeploy" badge into an HTML string.
 * The badge is fixed bottom-right, glass-morphism pill, links to homeUrl.
 */

const BADGE_CSS = `
#__dd_b{
  position:fixed;bottom:16px;right:16px;z-index:2147483647;
  display:inline-flex;align-items:center;gap:5px;
  padding:5px 10px 5px 6px;
  background:rgba(255,255,255,0.88);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(9,9,11,0.08);
  border-radius:100px;
  text-decoration:none;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:11px;font-weight:600;
  color:#09090b;letter-spacing:-0.02em;
  box-shadow:0 2px 12px rgba(0,0,0,0.10),inset 0 1px 0 rgba(255,255,255,0.9);
  transition:transform .15s,box-shadow .15s;
  user-select:none;
}
#__dd_b:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,0.9);}
`.trim()

const ISOTYPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="13" height="13" aria-hidden="true" style="display:block;flex-shrink:0"><g transform="translate(4,4)"><line x1="16" y1="4" x2="10" y2="20" stroke="#09090b" stroke-width="3" stroke-linecap="square" fill="none"/><line x1="10" y1="4" x2="4" y2="20" stroke="#09090b" stroke-width="3" stroke-linecap="square" fill="none"/><rect x="18" y="16" width="4" height="4" fill="#09090b" stroke="none"/></g></svg>`

export function injectWatermark(html: string, homeUrl: string): string {
  const badge = `\n<style id="__dd_s">${BADGE_CSS}</style>\n<a id="__dd_b" href="${homeUrl}" target="_blank" rel="noopener noreferrer" title="Deployed on dropdeploy">${ISOTYPE_SVG}dropdeploy</a>`

  // Prefer inserting before </body>
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${badge}\n</body>`)
  }
  // Fallback: before </html>
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${badge}\n</html>`)
  }
  // Bare HTML fragment — append
  return html + badge
}
