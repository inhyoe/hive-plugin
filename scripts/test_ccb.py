#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# test_ccb.py — CCB bridge connectivity test
# Validates ccb-ping reachability for configured providers.

import subprocess
import shutil
import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description='Test CCB bridge connectivity.')
    parser.add_argument('--providers', default='codex,gemini',
                        help='Comma-separated list of providers to test.')
    args = parser.parse_args()

    providers = [p.strip() for p in args.providers.split(',')]

    # 1. Check if ccb-ping exists
    if not shutil.which('ccb-ping'):
        print('[WARN] ccb-ping not found — CCB tests skipped')
        sys.exit(0)

    mounted_count = 0
    total_count = len(providers)

    # 2. Iterate through providers
    for provider in providers:
        try:
            result = subprocess.run(
                ['ccb-ping', provider],
                capture_output=True, timeout=30
            )
            if result.returncode == 0:
                print(f'[PASS] {provider} reachable')
                mounted_count += 1
            else:
                print(f'[WARN] {provider} unreachable (not blocking)')
        except subprocess.TimeoutExpired:
            print(f'[WARN] {provider} connection timed out')
        except Exception as e:
            print(f'[WARN] {provider} check failed: {e}')

    # 3. Summary
    print(f'--- Summary: Mounted {mounted_count}/{total_count} providers ---')

    # Always exit 0 — CCB failures are warnings, not errors
    sys.exit(0)


if __name__ == '__main__':
    main()
