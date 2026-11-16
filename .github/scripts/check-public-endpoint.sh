#!/usr/bin/env bash
set -euo pipefail

url=${1:?Public endpoint URL is required}
kind=${2:?Endpoint kind is required}
case "$kind" in
  version) filter='type == "object" and (.version | type == "string" and length > 0)' ;;
  cms) filter='type == "object" and has("user")' ;;
  *) echo "Unknown endpoint kind: $kind" >&2; exit 1 ;;
esac

body_file=$(mktemp)
trap 'rm -f "$body_file"' EXIT
deadline=$((SECONDS + 300))
http_code=000

while (( SECONDS < deadline )); do
  remaining=$((deadline - SECONDS))
  timeout=$((remaining < 20 ? remaining : 20))
  if http_code=$(curl --silent --show-error --connect-timeout 5 \
    --max-time "$timeout" --output "$body_file" --write-out '%{http_code}' "$url"); then
    if [[ "$http_code" == 200 ]] && jq -e "$filter" "$body_file" > /dev/null; then
      echo "Public endpoint verified: $url"
      exit 0
    fi
  fi

  echo "Waiting for $url (HTTP $http_code; expecting 200 and valid $kind JSON)"
  remaining=$((deadline - SECONDS))
  if (( remaining > 0 )); then
    sleep "$((remaining < 10 ? remaining : 10))"
  fi
done

echo "::error::Public endpoint $url failed verification within 300 seconds (last HTTP $http_code). Check public IP allocation, DNS, and application startup." >&2
exit 1
