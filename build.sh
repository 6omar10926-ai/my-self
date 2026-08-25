#!/usr/bin/env bash
# يبني نسخة بملف واحد: dist/index.html (تعمل بالنقر المزدوج)
# و dist/artifact.html (محتوى الصفحة فقط، للنشر كصفحة مستضافة)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

CSS=$(cat assets/styles.css)
JS=$(cat assets/util.js assets/store.js assets/ui.js assets/forms.js assets/views.js assets/report.js assets/app.js)

# محتوى الصفحة فقط (بدون html/head/body) — يُدرَج داخل أي هيكل صفحة
{
  echo '<title>منصّة أشغالي</title>'
  echo '<script>document.documentElement.setAttribute("dir","rtl");document.documentElement.setAttribute("lang","ar");</script>'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com">'
  echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">'
  echo '<style>'; printf '%s\n' "$CSS"; echo '</style>'
  # هيكل الصفحة من index.html: ما بين <body> و </body>، بدون وسوم <script src>
  sed -n '/<body>/,/<\/body>/p' index.html \
    | sed '1d;$d' \
    | grep -v '<script src=' \
    | sed 's|<link rel="stylesheet"[^>]*>||'
  echo '<script>'
  # نزع تسجيل عامل الخدمة (غير مطلوب في نسخة الملف الواحد)
  printf '%s\n' "$JS" | python3 -c "
import sys, re
src = sys.stdin.read()
src = re.sub(r\"  if \\('serviceWorker' in navigator\\) \\{[\\s\\S]*?\\n  \\}\\n\", '', src)
sys.stdout.write(src)
"
  echo '</script>'
} > dist/artifact.html

# نسخة كاملة قائمة بذاتها
{
  echo '<!doctype html>'
  echo '<html lang="ar" dir="rtl">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="theme-color" content="#1d4ed8">'
  cat dist/artifact.html | sed -n '1,/<\/style>/p'
  echo '</head>'
  echo '<body>'
  cat dist/artifact.html | sed -n '/<\/style>/,$p' | sed '1d'
  echo '</body>'
  echo '</html>'
} > dist/index.html

echo "بُني: dist/index.html ($(wc -c < dist/index.html) بايت) · dist/artifact.html ($(wc -c < dist/artifact.html) بايت)"
