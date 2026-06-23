# ZAP DAST Ignore Rules

Rules suppressed in `.zap/rules.tsv` with justification:

| Rule ID | Name | Reason |
|---------|------|--------|
| 10035 | Strict-Transport-Security Header Not Set | HSTS is configured in Cloudflare (SSL/TLS → Edge Certificates → HSTS). ZAP scans the HTTP→HTTPS redirect path and does not see the header Cloudflare injects on HTTPS responses. |
| 10055 | CSP: style-src unsafe-inline / Missing Directives | `style-src unsafe-inline` is required by the framework (Angular/Svelte). `form-action` and `base-uri` are explicitly defined in the CSP — ZAP flags these as informational when `default-src` has no fallback for them. |
| 10109 | Modern Web Application | Informational finding — ZAP detected a SPA/PWA. Not a vulnerability. |
| 10015 | Re-examine Cache-control Directives | Informational finding about cache headers. Not a vulnerability. |
| 10049 | Storable and Cacheable Content | Informational finding. Static assets are intentionally cacheable. |
| 10096 | Timestamp Disclosure - Unix | Build timestamps embedded in JS bundles by the build tool. Not sensitive data. |
