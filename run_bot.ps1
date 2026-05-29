$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "==========================================="
Write-Host "   MEMULAI BOT GMAPS & WA OTOMATIS"
Write-Host "   $(Get-Date)"
Write-Host "==========================================="

$Targets = @(
  "Make Up Artist|Jakarta",
  "Catering Pernikahan|Bandung",
  "Wedding Organizer|Surabaya",
  "Make Up Artist|Semarang",
  "Wedding Organizer|Medan",
  "Catering Pernikahan|Yogyakarta"
)

$RandomIndex = Get-Random -Minimum 0 -Maximum $Targets.Length
$SelectedTarget = $Targets[$RandomIndex]

$Parts = $SelectedTarget -split "\|"
$Niche = $Parts[0]
$City = $Parts[1]
$TotalLeads = 10

Write-Host "Target hari ini: $Niche di $City"
Write-Host "[1/2] Menjalankan Python Scraper..."

try {
    python backend_scraper.py "$Niche" "$City" "$TotalLeads"
} catch {
    Write-Host "Gagal menjalankan python backend_scraper.py"
}

Write-Host "[2/2] Menjalankan Node.js WA Sender..."
npm start

Write-Host "==========================================="
Write-Host "   EKSEKUSI SELESAI"
Write-Host "==========================================="
