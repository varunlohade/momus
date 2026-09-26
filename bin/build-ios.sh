#!/usr/bin/env bash
# Builds an iOS app with Xcode from a branch on origin and uploads it to
# TestFlight. Momus runs this when someone asks for a build.
#
#   bin/build-ios.sh <branch> [--no-upload]
#
# Guardrails built in:
#   - Always builds from a FRESH worktree of origin/<branch>, never from a
#     local checkout. A local checkout can be many commits behind origin, and
#     a stale build wastes a tester's day.
#   - Only uploads to TestFlight. It never submits to App Store review.
#   - Prints the exact commit it built, so every build can be traced.
#
# Env (see .env.example):
#   APP_REPO          path to the app's git repo
#   BUILD_KIND        flutter | xcode            (default xcode)
#   XCODE_WORKSPACE   e.g. ios/Runner.xcworkspace (relative to the repo)
#   XCODE_SCHEME      e.g. Runner
#   EXPORT_OPTIONS    path to an ExportOptions.plist (app-store-connect method)
#   ASC_KEY_ID / ASC_ISSUER_ID   App Store Connect API key, used for upload.
#                     altool looks for ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8
#
# Prints one JSON line: {branch, commit, buildNumber, ipa, uploaded}.
set -euo pipefail

branch="${1:?usage: build-ios.sh <branch> [--no-upload]}"
upload=1
[[ "${2:-}" == "--no-upload" ]] && upload=0

: "${APP_REPO:?APP_REPO not set}"
: "${EXPORT_OPTIONS:?EXPORT_OPTIONS not set}"
kind="${BUILD_KIND:-xcode}"
build_number="$(date +%y%m%d%H%M)"   # always increasing, no bump commits needed

git -C "$APP_REPO" fetch --quiet origin "$branch"
commit="$(git -C "$APP_REPO" rev-parse "origin/$branch")"

work="$(mktemp -d)/app"
git -C "$APP_REPO" worktree add --quiet --detach "$work" "$commit"
cleanup() { git -C "$APP_REPO" worktree remove --force "$work" >/dev/null 2>&1 || true; }
trap cleanup EXIT

out="$work/build/momus"
mkdir -p "$out"

if [[ "$kind" == "flutter" ]]; then
  (cd "$work" && flutter pub get >&2 && \
    flutter build ipa --release --build-number "$build_number" \
      --export-options-plist "$EXPORT_OPTIONS" >&2)
  ipa="$(ls "$work"/build/ios/ipa/*.ipa | head -1)"
else
  : "${XCODE_WORKSPACE:?XCODE_WORKSPACE not set}"
  : "${XCODE_SCHEME:?XCODE_SCHEME not set}"
  xcodebuild -workspace "$work/$XCODE_WORKSPACE" -scheme "$XCODE_SCHEME" \
    -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$out/app.xcarchive" -allowProvisioningUpdates \
    CURRENT_PROJECT_VERSION="$build_number" archive >&2
  xcodebuild -exportArchive -archivePath "$out/app.xcarchive" \
    -exportOptionsPlist "$EXPORT_OPTIONS" -exportPath "$out" \
    -allowProvisioningUpdates >&2
  ipa="$(ls "$out"/*.ipa | head -1)"
fi

# Keep the IPA after the worktree is removed.
keep="${MOMUS_DATA_DIR:-$(cd "$(dirname "$0")/.." && pwd)/data}/builds"
mkdir -p "$keep"
cp "$ipa" "$keep/$build_number.ipa"
ipa="$keep/$build_number.ipa"

uploaded=false
if [[ $upload -eq 1 ]]; then
  : "${ASC_KEY_ID:?ASC_KEY_ID not set}"
  : "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set}"
  xcrun altool --upload-app --type ios -f "$ipa" \
    --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" >&2
  uploaded=true
fi

printf '{"branch":"%s","commit":"%s","buildNumber":"%s","ipa":"%s","uploaded":%s}\n' \
  "$branch" "$commit" "$build_number" "$ipa" "$uploaded"
