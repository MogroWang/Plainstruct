$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root "src-tauri\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

Add-Type -AssemblyName System.Drawing

# 素构占位图标:#333 底 + #f5f5f3 的三块几何结构(与 public/logo.svg 同款)
function New-IconBitmap {
  param([int]$Size)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $bg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#333333"))
  $fg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#f5f5f3"))
  $g.FillRectangle($bg, 0, 0, $Size, $Size)
  $w = [Math]::Max(1, [int]($Size * 0.4))
  $h = [Math]::Max(1, [int]($Size * 0.44))
  $x = [int]($Size * 0.12)
  $y = [int]($Size * 0.12)
  $g.FillRectangle($fg, $x, $y, $w, $h)
  $g.FillRectangle($fg, $x + $w, $y, $w, $w)
  $g.FillRectangle($fg, $x, $y + $h, $w, $h)
  $g.Dispose()
  return $bmp
}

# 1024 源图(供 tauri icon 生成全套尺寸)
$src = New-IconBitmap -Size 1024
$src.Save((Join-Path $iconDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()

# 常用尺寸兜底(tauri icon 亦会重新生成)
$sizes = @(32, 128, 256)
foreach ($size in $sizes) {
  $bmp = New-IconBitmap -Size $size
  $path = Join-Path $iconDir "icon.png"
  if ($size -eq 32) { $path = Join-Path $iconDir "32x32.png" }
  if ($size -eq 128) { $path = Join-Path $iconDir "128x128.png" }
  if ($size -eq 256) { $path = Join-Path $iconDir "128x128@2x.png" }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Write-Host "Placeholder icons generated in $iconDir"
Write-Host "Run 'npm run icons' to let Tauri generate icon.ico / icon.icns from icon.png"
