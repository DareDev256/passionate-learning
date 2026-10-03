#!/bin/zsh
# Build, deploy the static export to Vercel (project passionate-learning), verify headers and content live.
set -e
cd "$(dirname "$0")"
npx tsx scripts/validate-content.ts
npx vitest run > /tmp/pl-test.log 2>&1 || { tail -20 /tmp/pl-test.log; echo "TESTS FAILED: not deploying"; exit 1; }
npx next build > /tmp/pl-build.log 2>&1 || { tail -30 /tmp/pl-build.log; exit 1; }
cat > out/vercel.json <<'JSON'
{ "cleanUrls": false, "trailingSlash": true,
  "headers": [ { "source": "/(.*)", "headers": [
    { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" } ] },
    { "source": "/sw.js", "headers": [ { "key": "Cache-Control", "value": "no-cache" } ] } ] }
JSON
mkdir -p out/.vercel
[ -f .vercel-project.json ] && cp .vercel-project.json out/.vercel/project.json
cd out && timeout 600 /Users/t./.bun/bin/vercel deploy --prod --yes --scope daredev256s-projects > /tmp/pl-deploy.log 2>&1 || { tail -20 /tmp/pl-deploy.log; exit 1; }
[ -f .vercel/project.json ] && cp .vercel/project.json ../.vercel-project.json
grep -oE "https://[a-z0-9.-]+\.vercel\.app" /tmp/pl-deploy.log | tail -2
