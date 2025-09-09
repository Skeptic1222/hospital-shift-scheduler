#!/usr/bin/env bash
# Helper functions for WSL when working with IIS on Windows
set -euo pipefail

winhost_ip() {
  awk '/nameserver/ {print $2; exit}' /etc/resolv.conf
}

add_publicip_alias() {
  local ip=$(winhost_ip)
  if ! grep -q "\bpublicip\b" /etc/hosts; then
    echo "$ip publicip" | sudo tee -a /etc/hosts >/dev/null
    echo "Added: $ip publicip"
  else
    echo "Alias 'publicip' already present in /etc/hosts"
  fi
}

case "${1:-}" in
  winhost-ip)
    winhost_ip
    ;;
  add-publicip)
    add_publicip_alias
    ;;
  *)
    echo "Usage: $0 {winhost-ip|add-publicip}" >&2
    exit 1
    ;;
esac

