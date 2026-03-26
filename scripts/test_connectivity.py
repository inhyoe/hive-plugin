#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# test_connectivity.py — tmux-bridge provider connectivity test
# Validates tmux-bridge reachability for configured providers.

import subprocess
import argparse
import sys
import os


def main():
    parser = argparse.ArgumentParser(description='Test tmux-bridge provider connectivity.')
    parser.add_argument('--providers', default='codex,gemini',
                        help='Comma-separated list of providers to test.')
    args = parser.parse_args()

    providers = [p.strip() for p in args.providers.split(',')]

    # 1. Check if tmux-bridge CLI exists
    cli_path = os.path.join(os.path.dirname(__file__), '..', 'hooks', 'tmux-bridge', 'dist', 'cli.js')
    if not os.path.isfile(cli_path):
        print('[WARN] tmux-bridge CLI not found — connectivity tests skipped')
        sys.exit(0)

    mounted_count = 0
    total_count = len(providers)

    # 2. Iterate through providers
    for provider in providers:
        try:
            result = subprocess.run(
                ['node', cli_path, 'status', '--provider', provider],
                capture_output=True, timeout=30
            )
            if result.returncode == 0:
                print(f'[PASS] {provider} reachable via tmux-bridge')
                mounted_count += 1
            else:
                print(f'[WARN] {provider} unreachable (not blocking)')
        except subprocess.TimeoutExpired:
            print(f'[WARN] {provider} connection timed out')
        except Exception as e:
            print(f'[WARN] {provider} check failed: {e}')

    # 3. Summary
    print(f'--- Summary: Mounted {mounted_count}/{total_count} providers ---')

    # Always exit 0 — connectivity failures are warnings, not errors
    sys.exit(0)


if __name__ == '__main__':
    main()
