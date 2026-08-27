#!/bin/sh
# Regenerate the donate QR codes (theme: LCD green on deep olive).
# Requires npx; output committed to donate/*.png — rerun only when the
# receive-money links change. Dev tool, not part of the game runtime.
set -e
cd "$(dirname "$0")/.."
mkdir -p donate

ALIPAY_URL='https://qr.alipay.com/fkx16432isyyhmx9ttwpi79'
WECHAT_URL='wxp://f2f1fJpOcJc7F-MSeLMxALhc6tWu-oohtxueHRbCe98bMy2AmDunimuOJFv-8bjobLBM'

npx -y qrcode -o donate/alipay-qr.png -w 560 -m 3 -e H -d '#c3d179' -l '#252d12' "$ALIPAY_URL"
npx -y qrcode -o donate/wechat-qr.png -w 560 -m 3 -e H -d '#c3d179' -l '#252d12' "$WECHAT_URL"
echo "donate QR codes written to donate/"
