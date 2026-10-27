#!/bin/sh
# This launcher lives beside the packaged plm executable. It requires no Node installation.
set -eu
PLM_APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PLM_STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/plm"
umask 077
mkdir -p "$PLM_STATE_DIR"
unset ELECTRON_RUN_AS_NODE
PLM_RESULT=0
"$PLM_APP_DIR/plm" "$@" >> "$PLM_STATE_DIR/startup.log" 2>&1 || PLM_RESULT=$?
if [ "$PLM_RESULT" -ne 0 ]; then
  printf 'PLM no pudo iniciarse. Revisa %s/startup.log\n' "$PLM_STATE_DIR" >&2
  if command -v notify-send >/dev/null 2>&1; then
    notify-send 'PLM no pudo iniciarse' "Revisa $PLM_STATE_DIR/startup.log" || true
  fi
fi
exit "$PLM_RESULT"
