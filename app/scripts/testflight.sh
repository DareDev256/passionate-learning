#!/usr/bin/env bash
# Archive the iOS app and upload it to TestFlight.
#
#   scripts/testflight.sh                              archive, export and upload
#   scripts/testflight.sh --check-only [--bundle-id X] only ask App Store Connect whether the app record exists
#
# Exit codes: 0 ok, 1 failure, 3 the App Store Connect app record does not exist yet (James signs in to
# appstoreconnect.apple.com once and Claude creates it; the API cannot create app records).
#
# Signing is automatic with the paid team Xcode already knows (com.apple.dt.Xcode IDEProvisioningTeamByIdentifier).
# Upload uses the App Store Connect API key in ~/.secrets (asc-api-key.p8, asc-api-key-id, asc-api-issuer-id).
# Key material is never printed. Build number: BUILD=<n> sets CURRENT_PROJECT_VERSION (default: a timestamp, so
# each upload is unique).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_ID="ca.stiersolutions.passionatelearning"
CHECK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --bundle-id) BUNDLE_ID="${2:?--bundle-id needs a value}"; shift ;;
    *) echo "usage: scripts/testflight.sh [--check-only] [--bundle-id <id>]" >&2; exit 2 ;;
  esac
  shift
done

fail() { echo "testflight: FAIL: $*" >&2; exit 1; }
say() { echo "testflight: $*"; }

# 1. The app record. Archiving without one wastes a build and the upload is rejected.
EXISTS="$(node "$APP_DIR/scripts/asc.mjs" app-exists "$BUNDLE_ID")" || fail "could not query App Store Connect"
if [ "$EXISTS" != "yes" ]; then
  echo "App record missing: James signs in to appstoreconnect.apple.com and Claude creates it" >&2
  exit 3
fi
say "app record exists for $BUNDLE_ID"
[ "$CHECK_ONLY" = 1 ] && exit 0

# 2. The paid team Xcode is signed in with (never a free personal team).
TEAM="$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const teams=[...s.matchAll(/isFreeProvisioningTeam = (\d);[\s\S]*?teamID = (\w+);/g)].filter(m=>m[1]==='0');
  if(teams[0])console.log(teams[0][2]);
});")"
[ -n "$TEAM" ] || fail "no paid Apple Developer team found in Xcode (sign in under Xcode > Settings > Accounts)"
say "team $TEAM"

SECRETS="$HOME/.secrets"
for f in asc-api-key.p8 asc-api-key-id asc-api-issuer-id; do [ -s "$SECRETS/$f" ] || fail "missing ~/.secrets/$f"; done

OUT="$APP_DIR/ios/DerivedData/testflight"
ARCHIVE="$OUT/App.xcarchive"
rm -rf "$OUT"; mkdir -p "$OUT"
EXPORT_PLIST="$OUT/ExportOptions.plist"
sed "s/__TEAM_ID__/$TEAM/" "$APP_DIR/ios/ExportOptions.plist" > "$EXPORT_PLIST"

AUTH=(-authenticationKeyPath "$SECRETS/asc-api-key.p8"
      -authenticationKeyID "$(tr -d '[:space:]' < "$SECRETS/asc-api-key-id")"
      -authenticationKeyIssuerID "$(tr -d '[:space:]' < "$SECRETS/asc-api-issuer-id")")

# 3. Fresh web build into the app, then archive.
say "syncing web build"
(cd "$APP_DIR" && npm run ios:sync >"$OUT/sync.log" 2>&1) || { tail -20 "$OUT/sync.log" >&2; fail "ios:sync failed"; }

BUILD="${BUILD:-$(date +%y%m%d%H%M)}"
say "archiving build $BUILD"
xcodebuild archive -project "$APP_DIR/ios/App/App.xcodeproj" -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic CURRENT_PROJECT_VERSION="$BUILD" \
  -allowProvisioningUpdates "${AUTH[@]}" >"$OUT/archive.log" 2>&1 \
  || { tail -30 "$OUT/archive.log" >&2; fail "archive failed (full log: $OUT/archive.log)"; }

# 4. Export with destination upload: this sends the build to App Store Connect.
say "exporting and uploading"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$EXPORT_PLIST" -exportPath "$OUT/export" \
  -allowProvisioningUpdates "${AUTH[@]}" >"$OUT/export.log" 2>&1 \
  || { tail -30 "$OUT/export.log" >&2; fail "export/upload failed (full log: $OUT/export.log)"; }

say "uploaded build $BUILD of $BUNDLE_ID; it appears in TestFlight after Apple finishes processing it"
