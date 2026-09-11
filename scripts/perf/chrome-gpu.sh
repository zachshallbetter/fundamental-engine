#!/usr/bin/env bash
# Launch / stop a GPU-accelerated headless Chrome for the RC-7 sweep on the titan-gpu runner.
#   chrome-gpu.sh start <dpr>   — headless=new, ANGLE over Vulkan (hardware WebGL + GPU raster, no X display), CDP on $CDP_PORT
#   chrome-gpu.sh stop
# The renderer string the sweep reads back must be an NVIDIA/ANGLE device, never SwiftShader — the
# fact sheet records it, and a software rasterizer would silently invalidate every fill-rate number.
set -euo pipefail
CDP_PORT="${CDP_PORT:-9333}"
PROFILE="${RUNNER_TEMP:-/tmp}/fe-perf-profile"
case "${1:-}" in
  start)
    DPR="${2:-1}"
    pkill -f "remote-debugging-port=$CDP_PORT" 2>/dev/null || true
    rm -rf "$PROFILE"
    setsid nohup google-chrome --headless=new --no-sandbox --disable-dev-shm-usage \
      --remote-debugging-port="$CDP_PORT" --remote-debugging-address=127.0.0.1 \
      --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan \
      --ignore-gpu-blocklist --enable-gpu-rasterization \
      --force-device-scale-factor="$DPR" --window-size=1600,900 \
      --user-data-dir="$PROFILE" about:blank > "${RUNNER_TEMP:-/tmp}/chrome-dpr$DPR.log" 2>&1 < /dev/null &
    for i in $(seq 1 30); do curl -sf "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null && break; sleep 1; done
    curl -sf "http://127.0.0.1:$CDP_PORT/json/version" | head -3
    ;;
  stop)
    pkill -f "remote-debugging-port=$CDP_PORT" 2>/dev/null || true
    ;;
  *) echo "usage: $0 start <dpr> | stop"; exit 2;;
esac
