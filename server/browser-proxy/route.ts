import type { Express } from 'express';

export function registerBrowserProxyRoute(app: Express, fetchImpl: typeof fetch = fetch): void {
  // Browser Proxy Endpoint to allow embedding sites inside iFrame by stripping framing headers & handling CORS
  app.all('/api/browser-proxy', async (req, res) => {
    // 1. Enable Full CORS for any origin & preflight OPTIONS requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const rawUrl = (req.query.url as string) || (req.body?.url as string);
    if (!rawUrl) {
      return res.status(400).send('URL query parameter is required');
    }

    try {
      let targetUrl = rawUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const parsedUrl = new URL(targetUrl);
      const origin = parsedUrl.origin;

      // Construct clean headers for the outgoing target request
      const outgoingHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': (req.headers['accept'] as string) || '*/*',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Cache-Control': 'no-cache',
        'Origin': origin,
        'Referer': targetUrl,
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      };

      if (req.headers['content-type']) {
        outgoingHeaders['Content-Type'] = req.headers['content-type'] as string;
      }
      if (req.headers['authorization']) {
        outgoingHeaders['Authorization'] = req.headers['authorization'] as string;
      }
      if (req.headers['cookie']) {
        outgoingHeaders['Cookie'] = req.headers['cookie'] as string;
      }

      const fetchOptions: any = {
        method: req.method || 'GET',
        headers: outgoingHeaders,
        redirect: 'follow'
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (typeof req.body === 'string' && req.body.length > 0) {
          fetchOptions.body = req.body;
        } else if (Buffer.isBuffer(req.body)) {
          fetchOptions.body = req.body;
        } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }

      const response = await fetchImpl(targetUrl, fetchOptions);
      const contentType = response.headers.get('content-type') || 'text/html';

      res.setHeader('Content-Type', contentType);

      // Gracefully mock 200 OK for failed telemetry/tracking or sub-API calls (srmdata, msg, update, analytics) so Vue/Axios does not crash
      if (!response.ok) {
        if (targetUrl.includes('srmdata') || targetUrl.includes('/msg') || targetUrl.includes('userInfoManager') || targetUrl.includes('analysis') || !contentType.includes('text/html')) {
          return res.status(200).json({ code: "0", status: "ok", message: "proxied_mock_ok" });
        }
      }

      if (contentType.includes('text/html')) {
        let html = await response.text();

        // 2. Inject Client-Side Interceptor Script for Fetch, XHR, SPA Routing, and Link Click Navigation
        const interceptorScript = `
          <script id="__swiftship_proxy_script">
            (function() {
              if (window.__swiftship_proxy_active) return;
              window.__swiftship_proxy_active = true;

              const PROXY_BASE = window.location.origin + '/api/browser-proxy?url=';
              const LOCAL_ORIGIN = window.location.origin;
              const TARGET_ORIGIN = "${origin}";
              const INITIAL_TARGET_URL = "${targetUrl}";

              // Suppress non-critical background tracking & Axios unhandled rejections
              window.addEventListener('unhandledrejection', function(event) {
                if (event.reason) {
                  const msg = String(event.reason.message || event.reason);
                  if (msg.includes('403') || msg.includes('timeout') || msg.includes('AxiosError') || msg.includes('SDK')) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }
              });

              function getRawTargetUrl(urlStr) {
                if (!urlStr || typeof urlStr !== 'string') return '';
                if (urlStr.startsWith('data:') || urlStr.startsWith('blob:') || urlStr.startsWith('javascript:')) return urlStr;

                // Extract query param if already a proxy URL
                if (urlStr.includes('/api/browser-proxy?url=')) {
                  try {
                    const idx = urlStr.indexOf('/api/browser-proxy?url=');
                    const paramStr = urlStr.substring(idx + '/api/browser-proxy?url='.length);
                    const decoded = decodeURIComponent(paramStr);
                    if (decoded) return decoded;
                  } catch(e) {}
                }

                let fullUrl = urlStr;

                // If browser resolved link against local host/IP (e.g. http://192.168.0.7:3000/some-path or http://localhost:3000)
                if (urlStr.startsWith(LOCAL_ORIGIN)) {
                  const relPath = urlStr.substring(LOCAL_ORIGIN.length);
                  if (relPath.startsWith('/api/browser-proxy')) {
                    return urlStr;
                  }
                  fullUrl = TARGET_ORIGIN + relPath;
                } else if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|\d+\.\d+\.\d+\.\d+)(:\d+)?\//i.test(urlStr)) {
                  try {
                    const u = new URL(urlStr);
                    if (!u.pathname.startsWith('/api/browser-proxy')) {
                      fullUrl = TARGET_ORIGIN + u.pathname + u.search + u.hash;
                    }
                  } catch(e) {}
                } else if (urlStr.startsWith('//')) {
                  fullUrl = 'https:' + urlStr;
                } else if (urlStr.startsWith('/')) {
                  fullUrl = TARGET_ORIGIN + urlStr;
                } else if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
                  fullUrl = TARGET_ORIGIN + '/' + urlStr;
                }

                return fullUrl;
              }

              function toProxyUrl(urlStr) {
                if (!urlStr || typeof urlStr !== 'string') return urlStr;
                if (urlStr.startsWith('data:') || urlStr.startsWith('blob:') || urlStr.startsWith('javascript:')) return urlStr;
                if (urlStr.includes('/api/browser-proxy')) return urlStr;

                const fullUrl = getRawTargetUrl(urlStr);
                return PROXY_BASE + encodeURIComponent(fullUrl);
              }

              function notifyParentNavigation(urlStr) {
                try {
                  const rawUrl = getRawTargetUrl(urlStr);
                  if (rawUrl && window.parent && window.parent !== window) {
                    window.parent.postMessage({
                      type: 'SWIFTSHIP_NAVIGATED',
                      url: rawUrl
                    }, '*');
                  }
                } catch(e) {}
              }

              // Notify initial loaded URL to sync parent address bar
              notifyParentNavigation(INITIAL_TARGET_URL);

              // Intercept fetch()
              const origFetch = window.fetch;
              window.fetch = function(input, init) {
                try {
                  if (typeof input === 'string') {
                    input = toProxyUrl(input);
                  } else if (input && typeof input === 'object' && input.url) {
                    const proxied = toProxyUrl(input.url);
                    input = new Request(proxied, input);
                  }
                } catch(e) {}
                return origFetch.call(this, input, init);
              };

              // Intercept XMLHttpRequest (Axios / jQuery / native)
              const origOpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url, ...args) {
                try {
                  url = toProxyUrl(url);
                } catch(e) {}
                return origOpen.call(this, method, url, ...args);
              };

              // Intercept Link Click Navigation (<a href="...">)
              document.addEventListener('click', function(e) {
                let target = e.target;
                while (target && target !== document.body) {
                  if (target.tagName === 'A') {
                    const attrHref = target.getAttribute('href');
                    if (attrHref && !attrHref.startsWith('#') && !attrHref.startsWith('javascript:')) {
                      e.preventDefault();
                      const rawUrl = getRawTargetUrl(attrHref);
                      notifyParentNavigation(rawUrl);
                      window.location.href = toProxyUrl(rawUrl);
                      return;
                    }
                  }
                  target = target.parentElement;
                }
              }, true);

              // Intercept Form Submissions
              document.addEventListener('submit', function(e) {
                const form = e.target;
                if (form) {
                  const attrAction = form.getAttribute('action') || '';
                  const rawUrl = getRawTargetUrl(attrAction || INITIAL_TARGET_URL);
                  notifyParentNavigation(rawUrl);
                  form.action = toProxyUrl(rawUrl);
                }
              }, true);

              // Intercept window.open
              const origWinOpen = window.open;
              window.open = function(url, ...args) {
                if (url) {
                  const rawUrl = getRawTargetUrl(url);
                  notifyParentNavigation(rawUrl);
                  url = toProxyUrl(rawUrl);
                }
                return origWinOpen.call(this, url, ...args);
              };

              // Intercept SPA pushState & replaceState
              const origPushState = history.pushState;
              history.pushState = function(state, title, url) {
                if (url) {
                  const rawUrl = getRawTargetUrl(url);
                  notifyParentNavigation(rawUrl);
                }
                return origPushState.apply(this, arguments);
              };

              const origReplaceState = history.replaceState;
              history.replaceState = function(state, title, url) {
                if (url) {
                  const rawUrl = getRawTargetUrl(url);
                  notifyParentNavigation(rawUrl);
                }
                return origReplaceState.apply(this, arguments);
              };

            })();
          </script>
        `;

        const baseTag = `<base href="${origin}/">`;
        
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}${interceptorScript}`);
        } else if (html.includes('<HEAD>')) {
          html = html.replace('<HEAD>', `<HEAD>${baseTag}${interceptorScript}`);
        } else {
          html = baseTag + interceptorScript + html;
        }

        res.status(response.status).send(html);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(arrayBuffer));
      }
    } catch (err: any) {
      console.error('[BrowserProxy] Error fetching target URL:', err.message);
      res.status(500).send(`
        <div style="font-family: system-ui, sans-serif; padding: 2rem; background: #070709; color: #f8fafc; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" dir="rtl">
          <div style="width: 60px; height: 60px; border-radius: 20px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: #f43f5e; font-size: 28px;">
            ⚠️
          </div>
          <h2 style="color: #f43f5e; margin-bottom: 0.5rem; font-size: 18px; font-weight: 800;">تعذر فتح هذا الموقع داخل الواجهة عبر البروكسي</h2>
          <p style="color: #94a3b8; font-size: 13px; max-width: 480px; margin-bottom: 1.5rem; line-height: 1.6;">
            قد يفرض هذا الموقع حماية برمجية مشددة ضد التضمين (مثل Cloudflare أو CSP). يمكنك فتحه في شباك/نافذة جديدة.
          </p>
          <div style="display: flex; gap: 10px;">
            <a href="${rawUrl}" target="_blank" style="background: linear-gradient(135deg, #d4af37, #b58d24); color: #000; padding: 10px 24px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 13px; box-shadow: 0 4px 12px rgba(212,175,55,0.3);">
              فتح الموقع في نافذة جديدة ↗
            </a>
          </div>
        </div>
      `);
    }
  });
}
