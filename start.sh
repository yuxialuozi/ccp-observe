#!/usr/bin/env bash
# ccp-observe 一键启动（macOS / Linux / Git Bash）
#
#   ./start.sh                # 127.0.0.1:8787，自动打开面板
#   ./start.sh --port 8788    # 换端口
#   ./start.sh --no-open      # 不打开浏览器
#
# 环境变量：CCP_PYTHON、CCP_PORT、CCP_HOST、CCP_UPSTREAM

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${CCP_PORT:-8787}"
HOST="${CCP_HOST:-127.0.0.1}"
OPEN=1

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --no-open) OPEN=0; shift ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数: $1（试试 --help）" >&2; exit 1 ;;
  esac
done

# ---- 1. 找 Python 3 --------------------------------------------------------
PY=""
for cand in "${CCP_PYTHON:-}" python3 python py; do
  [ -z "$cand" ] && continue
  if [ "$cand" = "py" ]; then
    "$cand" -3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,9) else 1)' 2>/dev/null \
      && { PY="py -3"; break; }
  elif command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,9) else 1)' 2>/dev/null; then
    PY="$cand"; break
  fi
done
if [ -z "$PY" ]; then
  cat >&2 <<'EOF'
[!] 没有找到可用的 Python 3.9+。
    安装后重试，或用 CCP_PYTHON=/path/to/python 指定解释器。
    macOS:  brew install python
    Ubuntu: sudo apt install python3
EOF
  exit 1
fi
echo "[1/3] Python: $($PY -c 'import sys;print(sys.version.split()[0])')"

# ---- 2. 面板静态文件 -------------------------------------------------------
if [ ! -f "$ROOT/proxy/static/index.html" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "[2/3] 首次运行：构建面板（npm install && npm run build）…"
    ( cd "$ROOT/web" && { npm ci --silent 2>/dev/null || npm install --silent; } && npm run build --silent )
  else
    echo "[!] 缺少 proxy/static/index.html，且未安装 npm，无法构建面板。" >&2
    echo "    安装 Node.js 18+ 后执行：cd web && npm install && npm run build" >&2
    exit 1
  fi
else
  echo "[2/3] 面板静态文件已就绪"
fi

PANEL="http://$HOST:$PORT/_ccp/"

# 端口已被本产品占用时直接复用（例如上一次没有关掉）。
if $PY - "$HOST" "$PORT" <<'PY' 2>/dev/null
import json, sys, urllib.request
host, port = sys.argv[1], sys.argv[2]
try:
    with urllib.request.urlopen("http://%s:%s/_ccp/api/selftest" % (host, port), timeout=1.2) as r:
        data = json.load(r)
    raise SystemExit(0 if isinstance(data, dict) and "checks" in data else 1)
except Exception:
    raise SystemExit(1)
PY
then
  echo "[3/3] 检测到已在运行的 ccp-observe，直接复用"
  OWN_PID=""
else
  echo "[3/3] 启动代理 $HOST:$PORT …"
  $PY "$ROOT/proxy/proxy.py" --host "$HOST" --port "$PORT" &
  OWN_PID=$!
  CLEANED=0
  cleanup() {
    [ "$CLEANED" -eq 1 ] && return 0
    CLEANED=1
    if [ -n "${OWN_PID:-}" ] && kill -0 "$OWN_PID" 2>/dev/null; then
      kill "$OWN_PID" 2>/dev/null || true
      wait "$OWN_PID" 2>/dev/null || true
      echo "[ccp-observe] 代理已停止"
    fi
  }
  trap cleanup INT TERM EXIT

  # 等代理就绪（最多 10 秒）
  READY=0
  for _ in $(seq 1 50); do
    if $PY - "$HOST" "$PORT" <<'PY' 2>/dev/null
import sys, urllib.request
host, port = sys.argv[1], sys.argv[2]
try:
    urllib.request.urlopen("http://%s:%s/healthz" % (host, port), timeout=0.4).read()
    raise SystemExit(0)
except Exception:
    raise SystemExit(1)
PY
    then READY=1; break; fi
    sleep 0.2
  done
  if [ "$READY" -ne 1 ]; then
    echo "[!] 代理未能在 10 秒内就绪，请检查上方日志。" >&2
    exit 1
  fi
fi

# ---- 首次使用引导 ----------------------------------------------------------
UPSTREAM="$($PY - "$ROOT" <<'PY' 2>/dev/null || true
import json, os, sys
path = os.path.join(sys.argv[1], "proxy", "state", "config.json")
try:
    with open(path, encoding="utf-8") as fh:
        cfg = json.load(fh)
    print(cfg.get("upstream") or cfg.get("upstream_anthropic") or cfg.get("upstream_openai") or "")
except Exception:
    print("")
PY
)"
if [ -z "$UPSTREAM" ]; then
  cat <<EOF

  ┌─ 首次使用 ────────────────────────────────────────────────
  │ 还没有配置上游地址（任何 OpenAI / Anthropic 兼容端点都可以）。
  │ 打开面板 → 右上角齿轮 → 填写「上游地址」→ 保存。
  │ 示例：https://example.internal/v1
  └───────────────────────────────────────────────────────────
  面板：$PANEL

EOF
else
  echo "  面板：$PANEL   上游：$UPSTREAM"
fi

if [ "$OPEN" -eq 1 ]; then
  $PY -m webbrowser -t "$PANEL" >/dev/null 2>&1 || true
fi

if [ -n "${OWN_PID:-}" ]; then
  echo "  按 Ctrl+C 停止代理。"
  wait "$OWN_PID"
else
  echo "  代理由其它进程托管，本脚本退出。"
fi