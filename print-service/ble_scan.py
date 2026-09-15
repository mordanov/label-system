#!/usr/bin/env python3
"""Scan for nearby BLE devices. Stdout: INDEX TAB NAME TAB ADDRESS (one per line)."""
import asyncio
import sys


async def main() -> None:
    try:
        import bleak
    except ImportError:
        print("bleak not installed — run: pip install bleak", file=sys.stderr)
        sys.exit(1)
    print("Scanning for BLE devices (10 s)…", file=sys.stderr, flush=True)
    devices = await bleak.BleakScanner.discover(timeout=10.0)
    if not devices:
        sys.exit(1)
    devices.sort(key=lambda d: (d.name or "~").lower())
    for i, d in enumerate(devices, 1):
        print(f"{i}\t{d.name or '(unnamed)'}\t{d.address}")


asyncio.run(main())
