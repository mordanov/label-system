# print-service

Receives print jobs over HTTP and sends them to the MXW01 BLE thermal printer via bleak.

## Why native (not Docker)

Docker Desktop on macOS runs in a Linux VM and cannot access the host's Bluetooth adapter. This service must run directly on the macOS host.

## Setup

```bash
cd print-service
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configure

Set `PRINTER_BLE_ADDRESS` to your printer's Bluetooth address.  
Find it with:
```bash
python3 -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover())" | grep -i MXW
```

## Run

```bash
PRINTER_BLE_ADDRESS=XX:XX:XX:XX:XX:XX python main.py
```

Or from the project root after setting `.env`:

```bash
scripts/start.sh
```

## API

`POST /print` — multipart form fields:
- `inventory_number` (str)
- `name` (str)
- `created_at` (str)
- `icon_filename` (str)
- `icon_file` (file upload)

Returns `{"status": "printed"}` on success, 503 on BLE failure.

`GET /health` → `{"status": "ok"}`

## Optional: launchd auto-start

Create `~/Library/LaunchAgents/com.label-system.print-service.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.label-system.print-service</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/label-system/print-service/.venv/bin/python</string>
        <string>/path/to/label-system/print-service/main.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PRINTER_BLE_ADDRESS</key><string>XX:XX:XX:XX:XX:XX</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key><string>/path/to/label-system/print-service/print-service.log</string>
    <key>StandardErrorPath</key><string>/path/to/label-system/print-service/print-service.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.label-system.print-service.plist
```
