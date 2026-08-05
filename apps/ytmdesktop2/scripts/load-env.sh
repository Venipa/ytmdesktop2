#!/usr/bin/env sh

fail() {
  printf '%s\n' "$1" >&2
  return 1 2>/dev/null || exit 1
}

ENV_FILE="${1:-.env}"

[ -f "$ENV_FILE" ] || fail "Env file not found: $ENV_FILE"

# Export all variables defined while sourcing the file.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

printf 'Loaded environment from %s\n' "$ENV_FILE"
