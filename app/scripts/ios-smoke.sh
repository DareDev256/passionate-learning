#!/usr/bin/env bash
# Simulator smoke test for the iOS app.
#
#   scripts/ios-smoke.sh <device-name> [screenshot.png]
#
# Boots the named simulator headless (no Simulator.app window), creating it from the device type of the same
# name on the newest iOS runtime when it doesn't exist (for example "iPhone Duo" from
# com.apple.CoreSimulator.SimDeviceType.iPhone-Duo), builds the Debug simulator app (npm run ios:sync, then
# xcodebuild), installs it, launches ca.stiersolutions.passionatelearning, checks it is still running after it
# settles, and saves a screenshot. Any failure exits non-zero.
#
# A device with two displays (iPhone Duo: inner 2007x2853 px, cover 1398x2034 px) gets one screenshot per display,
# named <screenshot>-<width>x<height>.png, unless DISPLAY_ID picks one. Closed, only the cover display shows the app.
#
# Env:
#   SKIP_BUILD=1      install the last build instead of building (one build serves every simulator)
#   APPEARANCE=dark   set the simulator to dark (or light) before launch
#   SETTLE=8          seconds between launch and screenshot (a fresh install shows the splash for about 5 s)
#   DISPLAY_ID=1      screenshot only this display (ids are listed by: xcrun simctl io <udid> screenshot x.png)
set -euo pipefail

DEVICE="${1:-}"
[ -n "$DEVICE" ] || { echo "usage: scripts/ios-smoke.sh <device-name> [screenshot.png]" >&2; exit 2; }

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_ID="ca.stiersolutions.passionatelearning"
DERIVED="$APP_DIR/ios/DerivedData"
APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
SETTLE="${SETTLE:-8}"
SLUG="$(printf '%s' "$DEVICE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
SHOT="${2:-$APP_DIR/../docs/screenshots/$(date +%F)_smoke/$SLUG.png}"

fail() { echo "ios-smoke: FAIL: $*" >&2; exit 1; }
say() { echo "ios-smoke: $*"; }

# Reads simctl JSON on stdin and prints one field, so the script needs nothing beyond Xcode and Node.
json() {
  local expr="$1"; shift
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const r=($expr);if(r)console.log(r)})" "$@"
}

# The UDID of an available device with this exact name, preferring the newest runtime.
find_udid() {
  xcrun simctl list devices available -j | json "Object.entries(j.devices)
    .filter(([rt])=>rt.includes('.iOS-'))
    .sort(([a],[b])=>b.localeCompare(a,undefined,{numeric:true}))
    .flatMap(([,ds])=>ds).find(d=>d.name===process.argv[1])?.udid" "$DEVICE"
}

UDID="$(find_udid || true)"
if [ -z "$UDID" ]; then
  TYPE="$(xcrun simctl list devicetypes -j | json "j.devicetypes.find(t=>t.name===process.argv[1])?.identifier" "$DEVICE" || true)"
  [ -n "$TYPE" ] || fail "no simulator or device type named \"$DEVICE\""
  RUNTIME="$(xcrun simctl list runtimes available -j | json "j.runtimes.filter(r=>r.platform==='iOS'&&r.isAvailable)
    .sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0]?.identifier" || true)"
  [ -n "$RUNTIME" ] || fail "no available iOS runtime"
  say "creating \"$DEVICE\" ($TYPE on $RUNTIME)"
  UDID="$(xcrun simctl create "$DEVICE" "$TYPE" "$RUNTIME")" || fail "simctl create failed"
fi
say "device $DEVICE ($UDID)"

xcrun simctl bootstatus "$UDID" -b >/dev/null || fail "boot failed"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  say "building (npm run ios:sync, xcodebuild Debug for the simulator)"
  (cd "$APP_DIR" && npm run ios:sync >/dev/null) || fail "npm run ios:sync failed"
  xcodebuild -project "$APP_DIR/ios/App/App.xcodeproj" -scheme App -configuration Debug \
    -destination "generic/platform=iOS Simulator" -derivedDataPath "$DERIVED" build -quiet \
    || fail "xcodebuild failed"
fi
[ -d "$APP_PATH" ] || fail "no build at $APP_PATH (run without SKIP_BUILD=1)"

xcrun simctl install "$UDID" "$APP_PATH" || fail "install failed"
if [ -n "${APPEARANCE:-}" ]; then xcrun simctl ui "$UDID" appearance "$APPEARANCE" || fail "could not set appearance"; fi

xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE_ID" || fail "launch failed"
sleep "$SETTLE"
# Capture the list first: grep -q exits on its first match, and under pipefail the SIGPIPE it leaves launchctl
# would fail the check while the app is running.
RUNNING="$(xcrun simctl spawn "$UDID" launchctl list)" || fail "could not list the simulator's processes"
grep -q "UIKitApplication:$BUNDLE_ID" <<< "$RUNNING" || fail "the app is not running $SETTLE s after launch"

# iOS renders the launch screen into a snapshot when the app is installed. If it can't (a launch image over
# SplashBoard's 25 MB decoded limit, for one), it marks the app and shows black at every cold launch.
# Fails closed: if the log can't be read, the launch screen is unproven. Only grep's no-match (exit 1) passes.
LOG_ERR_FILE="$(mktemp)"
LAUNCH_LOG="$(xcrun simctl spawn "$UDID" log show --last "$((SETTLE + 20))s" --style compact --predicate \
  "subsystem == \"com.apple.SplashBoard\" AND eventMessage CONTAINS \"$BUNDLE_ID\" AND (eventMessage CONTAINS \"Unable to generate launch image\" OR eventMessage CONTAINS \"denylisted\")" \
  2>"$LOG_ERR_FILE")" || fail "could not read the simulator log to check the launch screen: $(head -1 "$LOG_ERR_FILE")"
rm -f "$LOG_ERR_FILE"
GREP_RC=0
LAUNCH_ERR="$(grep -v -e '^Timestamp' -e '^[[:space:]]*$' <<< "$LAUNCH_LOG")" || GREP_RC=$?
case "$GREP_RC" in
  1) ;;
  0) fail "iOS could not render the launch screen, so launches show black: $(head -1 <<< "$LAUNCH_ERR")" ;;
  *) fail "could not scan the launch screen log (grep exit $GREP_RC)" ;;
esac

mkdir -p "$(dirname "$SHOT")"
if [ -n "${DISPLAY_ID:-}" ]; then
  xcrun simctl io "$UDID" screenshot --display="$DISPLAY_ID" "$SHOT" >/dev/null 2>&1 || fail "screenshot of display $DISPLAY_ID failed"
  SHOTS=("$SHOT")
elif ERR="$(xcrun simctl io "$UDID" screenshot "$SHOT" 2>&1)"; then
  SHOTS=("$SHOT")
else
  # simctl refuses to guess on a two-display device and lists them as: --display=<id>  <name> <width>x<height>
  DISPLAYS="$(printf '%s\n' "$ERR" | sed -nE 's/.*--display=([0-9]+).* ([0-9]+x[0-9]+)$/\1 \2/p')"
  [ -n "$DISPLAYS" ] || fail "screenshot failed: $ERR"
  SHOTS=()
  while read -r ID SIZE; do
    OUT_FILE="${SHOT%.png}-$SIZE.png"
    xcrun simctl io "$UDID" screenshot --display="$ID" "$OUT_FILE" >/dev/null 2>&1 || fail "screenshot of display $ID failed"
    SHOTS+=("$OUT_FILE")
  done <<< "$DISPLAYS"
fi
for F in "${SHOTS[@]}"; do [ -s "$F" ] || fail "screenshot is empty: $F"; say "ok: $F"; done
