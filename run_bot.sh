#!/bin/bash

# Pastikan script ini dijalankan di dalam direktori maps_wa
cd "$(dirname "$0")"

echo "==========================================="
echo "   MEMULAI BOT GMAPS & WA OTOMATIS"
echo "   $(date)"
echo "==========================================="

# Daftar Target (Niche|Kota)
TARGETS=(
  "Make Up Artist|Jakarta"
  "Catering Pernikahan|Bandung"
  "Wedding Organizer|Surabaya"
  "Make Up Artist|Semarang"
  "Wedding Organizer|Medan"
  "Catering Pernikahan|Yogyakarta"
)

# Pilih target secara acak
RANDOM_INDEX=$((RANDOM % ${#TARGETS[@]}))
SELECTED_TARGET="${TARGETS[$RANDOM_INDEX]}"

# Split menggunakan delimiter pipe (|)
NICHE="${SELECTED_TARGET%|*}"
CITY="${SELECTED_TARGET#*|}"
TOTAL_LEADS=10

echo "Target hari ini: $NICHE di $CITY"

echo "[1/2] Menjalankan Python Scraper..."
# Pastikan python terinstall (atau gunakan python3 jika di Linux)
python3 backend_scraper.py "$NICHE" "$CITY" "$TOTAL_LEADS" || python backend_scraper.py "$NICHE" "$CITY" "$TOTAL_LEADS"

echo "[2/2] Menjalankan Node.js WA Sender..."
# Pastikan node terinstall
npm start

echo "==========================================="
echo "   EKSEKUSI SELESAI"
echo "==========================================="
