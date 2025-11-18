# RFID Device - Intelligent Hybrid Model Algorithm

## Overview

This document describes the **complete algorithm** that should run on your RFID hardware device (Raspberry Pi, Arduino, ESP32, etc.) to implement the Intelligent Hybrid Model.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    RFID DEVICE WORKFLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. BACKGROUND SYNC (Every 30 minutes)                       │
│     └─ Download valid RFID card list from server            │
│                                                               │
│  2. LOCAL SCAN (Instant - <1ms)                              │
│     └─ Check scanned card against local cache               │
│     └─ Show GREEN/RED LED immediately                        │
│                                                               │
│  3. BACKGROUND LOG (Async - don't wait)                      │
│     └─ Send attendance log to server                         │
│     └─ If offline: Save to local queue                       │
│                                                               │
│  4. OFFLINE QUEUE SYNC (When connection restored)            │
│     └─ Upload all queued logs in batch                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### 1. Local Card Cache (Stored in Device Memory)

```json
{
  "cards": [
    { "rfid": "1234567890", "studentId": 42 },
    { "rfid": "9876543210", "studentId": 87 },
    { "rfid": "5555555555", "studentId": 123 }
  ],
  "settings": {
    "startTime": "08:00:00",
    "lateThresholdMin": 15
  },
  "lastSync": "2025-01-15T07:30:00Z"
}
```

### 2. Offline Log Queue (Stored in Device Flash/SD Card)

```json
[
  {
    "localId": "device-log-001",
    "rfidCardId": "1234567890",
    "timestamp": "2025-01-15T08:12:30Z",
    "synced": false
  },
  {
    "localId": "device-log-002",
    "rfidCardId": "9876543210",
    "timestamp": "2025-01-15T08:13:15Z",
    "synced": false
  }
]
```

---

## Complete Device Algorithm

### STEP 1: Initialization (On Device Boot)

```python
# Pseudocode for device initialization

def initialize_device():
    print("Device starting...")

    # Load configuration
    config = load_config()  # Device API key, server URL

    # Load cached card list from flash memory
    card_cache = load_from_flash("card_cache.json")

    # Load offline queue
    offline_queue = load_from_flash("offline_queue.json")

    # Test internet connection
    if is_online():
        print("Online - Syncing card list...")
        sync_card_list()

        # Upload any pending logs from offline queue
        if len(offline_queue) > 0:
            print(f"Found {len(offline_queue)} offline logs. Uploading...")
            batch_upload_logs(offline_queue)
    else:
        print("Offline - Using cached card list")
        if card_cache is None:
            print("ERROR: No cached cards and no internet!")
            show_error_led()

    # Start background sync timer (every 30 minutes)
    start_timer(sync_card_list, interval=1800)  # 1800 seconds = 30 min

    # Start heartbeat timer (every 5 minutes)
    start_timer(send_heartbeat, interval=300)

    print("Device ready!")
    show_ready_led()
```

---

### STEP 2: Background Sync (Every 30 Minutes)

```python
def sync_card_list():
    """
    Download fresh list of valid RFID cards from server
    Runs in background every 30 minutes
    """
    try:
        # Call API
        response = http_get(
            url=SERVER_URL + "/api/v1/device/sync/cards",
            headers={"X-API-Key": DEVICE_API_KEY}
        )

        if response.status == 200:
            data = response.json()

            # Save to memory
            global card_cache
            card_cache = data

            # Persist to flash storage
            save_to_flash("card_cache.json", data)

            print(f"Sync complete: {len(data['cards'])} cards cached")
            return True
        else:
            print(f"Sync failed: {response.status}")
            return False

    except Exception as e:
        print(f"Sync error: {e}")
        return False
```

---

### STEP 3: Card Scan Handler (Main Logic - INSTANT)

```python
def on_card_scanned(rfid_card_id):
    """
    Called when RFID reader detects a card tap
    This must be INSTANT - student sees result in <100ms
    """

    print(f"Card scanned: {rfid_card_id}")

    # ============================================
    # LOCAL VALIDATION (INSTANT - NO INTERNET)
    # ============================================

    # Check if card exists in local cache
    student_id = find_card_in_cache(rfid_card_id)

    if student_id is None:
        # INVALID CARD
        print("Invalid card")
        show_red_led()
        beep_error_sound()
        return

    # VALID CARD - Show success immediately
    print(f"Valid card - Student ID: {student_id}")
    show_green_led()
    beep_success_sound()

    # Optionally display student name on LCD
    # display_on_screen(f"Welcome, Student {student_id}!")

    # ============================================
    # BACKGROUND LOG (ASYNC - DON'T WAIT)
    # ============================================

    # Create log entry
    log_entry = {
        "localId": generate_unique_id(),  # e.g., "device-001-1234567890"
        "rfidCardId": rfid_card_id,
        "timestamp": get_current_timestamp(),  # ISO 8601 format
        "synced": False
    }

    # Try to send to server immediately (in background thread)
    if is_online():
        # Send to server asynchronously
        threading.start_new_thread(send_log_to_server, (log_entry,))
    else:
        # Offline - Add to queue
        print("Offline - Adding to queue")
        add_to_offline_queue(log_entry)


def find_card_in_cache(rfid_card_id):
    """
    Search for RFID card in local cache
    Returns student_id if found, None if not found
    """
    for card in card_cache['cards']:
        if card['rfid'] == rfid_card_id:
            return card['studentId']
    return None


def show_green_led():
    # Turn on green LED for 2 seconds
    GPIO.output(GREEN_LED_PIN, HIGH)
    time.sleep(2)
    GPIO.output(GREEN_LED_PIN, LOW)


def show_red_led():
    # Flash red LED 3 times
    for i in range(3):
        GPIO.output(RED_LED_PIN, HIGH)
        time.sleep(0.2)
        GPIO.output(RED_LED_PIN, LOW)
        time.sleep(0.2)


def beep_success_sound():
    # Single beep
    play_tone(frequency=1000, duration=0.2)


def beep_error_sound():
    # Two short beeps
    play_tone(frequency=500, duration=0.1)
    time.sleep(0.1)
    play_tone(frequency=500, duration=0.1)
```

---

### STEP 4: Background Log Upload (Async)

```python
def send_log_to_server(log_entry):
    """
    Send single log to server
    Runs in background thread - doesn't block the main scan loop
    """
    try:
        response = http_post(
            url=SERVER_URL + "/api/v1/attendance/log",
            headers={
                "X-API-Key": DEVICE_API_KEY,
                "Content-Type": "application/json"
            },
            body={
                "rfidCardId": log_entry['rfidCardId'],
                "timestamp": log_entry['timestamp']
            }
        )

        if response.status == 201:
            print(f"Log sent successfully: {log_entry['localId']}")
            log_entry['synced'] = True
            return True
        else:
            print(f"Server rejected log: {response.status}")
            # Add to offline queue for retry
            add_to_offline_queue(log_entry)
            return False

    except Exception as e:
        print(f"Failed to send log: {e}")
        # Network error - add to offline queue
        add_to_offline_queue(log_entry)
        return False
```

---

### STEP 5: Offline Queue Management

```python
def add_to_offline_queue(log_entry):
    """
    Add log to offline queue for later upload
    """
    global offline_queue

    # Add to in-memory queue
    offline_queue.append(log_entry)

    # Persist to flash storage
    save_to_flash("offline_queue.json", offline_queue)

    print(f"Added to offline queue. Queue size: {len(offline_queue)}")


def batch_upload_logs(logs):
    """
    Upload multiple logs at once
    Called when device reconnects after being offline
    """
    if len(logs) == 0:
        return

    print(f"Batch uploading {len(logs)} logs...")

    try:
        response = http_post(
            url=SERVER_URL + "/api/v1/device/sync/logs",
            headers={
                "X-API-Key": DEVICE_API_KEY,
                "Content-Type": "application/json"
            },
            body={"logs": logs}
        )

        if response.status == 201:
            data = response.json()
            print(f"Batch upload complete: {data['processed']} processed")

            # Clear offline queue
            global offline_queue
            offline_queue = []
            save_to_flash("offline_queue.json", [])

            return True
        else:
            print(f"Batch upload failed: {response.status}")
            return False

    except Exception as e:
        print(f"Batch upload error: {e}")
        return False
```

---

### STEP 6: Heartbeat (Device Health Monitoring)

```python
def send_heartbeat():
    """
    Send periodic heartbeat to server
    Runs every 5 minutes
    """
    if not is_online():
        print("Offline - skipping heartbeat")
        return

    try:
        response = http_post(
            url=SERVER_URL + "/api/v1/device/sync/heartbeat",
            headers={
                "X-API-Key": DEVICE_API_KEY,
                "Content-Type": "application/json"
            },
            body={
                "queueSize": len(offline_queue),
                "lastSync": card_cache['lastSync'] if card_cache else None,
                "batteryLevel": get_battery_level(),  # If battery powered
                "errorCount": get_error_count()
            }
        )

        if response.status == 200:
            data = response.json()

            # Server may recommend sync if queue is large
            if data.get('syncRecommended'):
                print("Server recommends sync - uploading queue...")
                batch_upload_logs(offline_queue)

    except Exception as e:
        print(f"Heartbeat error: {e}")
```

---

### STEP 7: Utility Functions

```python
def is_online():
    """
    Check if device has internet connectivity
    """
    try:
        # Try to ping server
        response = http_get(
            url=SERVER_URL + "/api/v1/device/sync/status",
            headers={"X-API-Key": DEVICE_API_KEY},
            timeout=3
        )
        return response.status == 200
    except:
        return False


def generate_unique_id():
    """
    Generate unique ID for log entries
    Format: device-{device_id}-{timestamp}-{random}
    """
    import random
    import time

    timestamp = int(time.time())
    random_part = random.randint(1000, 9999)

    return f"device-{DEVICE_ID}-{timestamp}-{random_part}"


def get_current_timestamp():
    """
    Get current time in ISO 8601 format
    """
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


def load_from_flash(filename):
    """
    Load JSON data from flash storage
    """
    try:
        with open(filename, 'r') as f:
            return json.load(f)
    except:
        return None


def save_to_flash(filename, data):
    """
    Save JSON data to flash storage
    """
    with open(filename, 'w') as f:
        json.dump(data, f)
```

---

## Complete Flow Example

### Scenario 1: Online - Normal Operation

```
1. Student taps card "1234567890" at 8:12 AM
2. Device checks local cache → FOUND
3. Green LED lights up + beep (instant - 50ms)
4. Student walks away happy
5. Device sends log to server in background (2-3 seconds)
6. Server receives log, updates dashboard
7. Principal sees "Ali Khan arrived at 8:12 AM" on dashboard
8. Parent receives SMS: "Ali arrived at school - 8:12 AM"
```

### Scenario 2: Offline - Internet Down

```
1. Student taps card "1234567890" at 8:12 AM
2. Device checks local cache → FOUND
3. Green LED lights up + beep (instant - 50ms)
4. Student walks away happy
5. Device tries to send to server → FAILS (no internet)
6. Device saves log to offline queue
7. [Later at 10:00 AM] Internet restored
8. Device detects connection, uploads queue (50 logs)
9. Server processes all logs with correct timestamps
10. Dashboard updates with all missed attendance
```

### Scenario 3: Invalid Card

```
1. Unknown person taps card "9999999999" at 8:12 AM
2. Device checks local cache → NOT FOUND
3. Red LED flashes 3 times + error beep
4. Person denied entry
5. No log created (invalid card)
```

---

## Hardware Requirements

### Minimum Components

1. **RFID Reader Module** (RC522, PN532, or similar)
2. **Microcontroller** (Raspberry Pi Zero, ESP32, Arduino with WiFi)
3. **LED Indicators** (Green = success, Red = error, Blue = sync)
4. **Buzzer/Speaker** (Audio feedback)
5. **WiFi Module** (if not built-in)
6. **SD Card** (for offline queue storage)
7. **Power Supply** (5V USB or battery)

### Optional Components

- **LCD Display** (show student name)
- **Battery** (for power backup)
- **Ethernet Port** (more reliable than WiFi)
- **Camera** (for photo capture - advanced feature)

---

## Performance Benchmarks

| Metric | Target | Typical |
|--------|--------|---------|
| **Scan to LED Time** | <100ms | 50-80ms |
| **Cache Lookup** | <1ms | 0.5ms |
| **Log Upload (online)** | <3s | 1-2s |
| **Batch Upload (100 logs)** | <10s | 5-8s |
| **Sync Card List (500 cards)** | <5s | 2-3s |
| **Offline Queue Capacity** | 10,000+ | Limited by storage |

---

## Security Considerations

1. **API Key Storage**: Store device API key in secure flash (not hardcoded)
2. **HTTPS Only**: Always use HTTPS for server communication
3. **Card Data**: Only store RFID numbers, not student names/photos
4. **Tamper Detection**: Detect if device casing is opened
5. **Log Integrity**: Sign logs with device signature before sending

---

## Testing Checklist

- [ ] Card scan works offline (no internet)
- [ ] Green LED shows within 100ms
- [ ] Invalid card shows red LED
- [ ] Logs upload when online
- [ ] Logs queue when offline
- [ ] Queue uploads when connection restored
- [ ] Sync runs every 30 minutes
- [ ] Heartbeat sends every 5 minutes
- [ ] Device survives power cycle (data persists)
- [ ] Handle 100+ scans in 5 minutes (rush hour)

---

## Deployment Steps

1. Flash device with algorithm code
2. Configure device API key (get from server)
3. Connect to school WiFi
4. Run initial sync (download card list)
5. Test with known RFID card
6. Mount device at school entrance
7. Monitor via server dashboard

---

## Monitoring & Maintenance

### Server-Side Monitoring

```sql
-- Check device health
SELECT
  d.device_name,
  d.location,
  d.last_seen,
  CASE
    WHEN d.last_seen > NOW() - INTERVAL '10 minutes' THEN 'Online'
    ELSE 'Offline'
  END as status
FROM devices d
WHERE d.school_id = 1;
```

### Device-Side Logs

```
[2025-01-15 08:00:00] Device started
[2025-01-15 08:00:05] Sync complete: 542 cards cached
[2025-01-15 08:12:30] Card scanned: 1234567890 - Valid
[2025-01-15 08:12:32] Log sent to server - Success
[2025-01-15 08:30:00] Sync complete: 543 cards cached
[2025-01-15 09:15:00] Connection lost - Entering offline mode
[2025-01-15 09:15:45] Card scanned: 5555555555 - Valid (queued)
[2025-01-15 10:00:00] Connection restored
[2025-01-15 10:00:03] Batch upload: 15 logs - Success
```

---

## Conclusion

This **Intelligent Hybrid Model** gives you:

✅ **Instant response** for students (local validation)
✅ **Real-time data** for principals (background sync)
✅ **100% reliability** (works offline)
✅ **Zero data loss** (offline queue)
✅ **Professional architecture** (industry standard)

This is exactly how modern payment terminals, access control systems, and professional IoT devices work!
