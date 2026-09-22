#!/usr/bin/env bash
set -u
LAB=/tmp/omniframe-reference-lab
OUT=.audit/video-editors
mkdir -p "$LAB" "$OUT" .audit/references
cat > "$OUT/environment.txt" <<ENV
Date: $(date -Is)
OS: $(uname -a)
git: $(git --version 2>&1)
node: $(node --version 2>&1)
npm: $(npm --version 2>&1)
pnpm: $(pnpm --version 2>&1 || echo unavailable)
bun: $(bun --version 2>&1 || echo unavailable)
rustc: $(rustc --version 2>&1 || echo unavailable)
cargo: $(cargo --version 2>&1 || echo unavailable)
python: $(python3 --version 2>&1)
ENV
repos=(
'opencut|https://github.com/OpenCut-app/OpenCut'
'opencut-classic|https://github.com/OpenCut-app/opencut-classic'
'openreel-video|https://github.com/afatabe/openreel'
'clypra|https://github.com/AIEraDev/clypra'
'kdenlive|https://github.com/kde/kdenlive'
'shotcut|https://github.com/mltframework/shotcut'
'olive|https://github.com/olive-editor/olive'
'losslesscut|https://github.com/mifi/lossless-cut'
'openshot|https://github.com/OpenShot/openshot-qt'
'pitivi|https://github.com/GNOME/pitivi'
'flowblade|https://github.com/jliljebl/flowblade'
'natron|https://github.com/NatronGitHub/Natron'
'cinelerra-gg|https://github.com/cinelerra-gg/cinelerra-gg'
'vidcutter|https://github.com/ozmartian/vidcutter'
'ai-video-editor|https://github.com/tjameswilliams/ai-video-editor'
'synthcut|https://github.com/Relo-video/SynthCut'
'clipforge|https://github.com/Davaakhatan/clipforge'
'react-browser-video-editor|https://github.com/smart-developer1791/react-browser-video-editor'
'free-react-video-editor|https://github.com/reactvideoeditor/free-react-video-editor'
'quik-clip|https://github.com/graphicstone/quik-clip'
'remotion|https://github.com/remotion-dev/remotion'
)
: > "$OUT/clone-results.tsv"
for entry in "${repos[@]}"; do
  name=${entry%%|*}; url=${entry#*|}; dir="$LAB/$name"
  rm -rf "$dir"
  start=$(date +%s)
  if timeout 90 git clone --depth 1 --filter=blob:none --no-checkout "$url" "$dir" >"/tmp/${name}.clone.log" 2>&1; then
    commit=$(git -C "$dir" rev-parse HEAD)
    license=$(git -C "$dir" ls-tree -r --name-only HEAD | grep -Ei '(^|/)(license|copying)(\.|$)' | head -1 || true)
    files=$(git -C "$dir" ls-tree -r --name-only HEAD | grep -Ei '(timeline|timecode|ruler|playhead|zoom|shortcut|settings|preferences)' | head -40 | tr '\n' ';')
    printf '%s\tCLONED\t%s\t%s\t%s\t%ss\n' "$name" "$commit" "${license:-NOT_FOUND}" "$files" "$(( $(date +%s)-start ))" >> "$OUT/clone-results.tsv"
  else
    err=$(tail -3 "/tmp/${name}.clone.log" | tr '\n' ' ')
    printf '%s\tFAILED\t-\t-\t%s\t%ss\n' "$name" "$err" "$(( $(date +%s)-start ))" >> "$OUT/clone-results.tsv"
  fi
done
