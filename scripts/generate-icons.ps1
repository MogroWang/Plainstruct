$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root "src-tauri\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

Add-Type -AssemblyName System.Drawing

# 素构 logo 图形:与 public/logo.svg 数学等价(viewBox 251x243 展平后的五块形状)
#   嘴 = 底部横条;左侧括号;15% 透明斜杠;双眼 = 两根竖条
$script:MarkRects = @(
  ,@(0.0, 173.13, 250.4, 69.01)   # 底部横条(前置逗号防止 @() 展平嵌套数组)
)
$script:MarkEyes = @(
  ,@(89.71, 0.0, 49.04, 131.92)   # 左眼
  ,@(201.37, 0.0, 49.03, 131.92)  # 右眼
)
$script:MarkBracket = @(        # 左侧括号(E 形负空间)
  @(69.01, 173.13), @(69.01, 242.14), @(0.0, 242.14), @(0.0, 21.7),
  @(69.01, 21.7), @(69.01, 90.71), @(34.5, 90.71), @(34.5, 173.13)
)
$script:MarkSlash = @(          # 15% 透明斜杠
  @(104.06, 97.24), @(201.31, 0.0), @(235.98, 34.67), @(138.74, 131.92)
)

function New-IconBitmap {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgCol = [System.Drawing.ColorTranslator]::FromHtml("#1c1917")
  $fgCol = [System.Drawing.ColorTranslator]::FromHtml("#e7e5e4")

  # 圆角方形底板
  $r = $Size * 0.185
  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $bgPath.AddArc(0, 0, $r, $r, 180, 90)
  $bgPath.AddArc($Size - $r, 0, $r, $r, 270, 90)
  $bgPath.AddArc($Size - $r, $Size - $r, $r, $r, 0, 90)
  $bgPath.AddArc(0, $Size - $r, $r, $r, 90, 90)
  $bgPath.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush($bgCol)), $bgPath)
  $bgPath.Dispose()

  # 图形安全区:左右 12% 边距,logo 等比缩放居中
  $content = $Size * 0.76
  $scale = $content / 243.0
  $offX = ($Size - 251.0 * $scale) / 2.0
  $offY = ($Size - 243.0 * $scale) / 2.0
  $fg = New-Object System.Drawing.SolidBrush($fgCol)

  function MapX([double]$v) { return [single]($offX + $v * $scale) }
  function MapY([double]$v) { return [single]($offY + $v * $scale) }
  # 矩形转四点 Polygon(GDI+ 的 FillRectangle 单精度重载在 PS 中绑定不稳,统一走 FillPolygon)
  function RectPoints([double]$X, [double]$Y, [double]$W, [double]$H) {
    $pts = New-Object 'System.Drawing.PointF[]' 4
    $pts[0] = New-Object System.Drawing.PointF((MapX $X), (MapY $Y))
    $pts[1] = New-Object System.Drawing.PointF((MapX ($X + $W)), (MapY $Y))
    $pts[2] = New-Object System.Drawing.PointF((MapX ($X + $W)), (MapY ($Y + $H)))
    $pts[3] = New-Object System.Drawing.PointF((MapX $X), (MapY ($Y + $H)))
    return ,$pts
  }

  # 底部横条(嘴)
  $m = $script:MarkRects[0]
  $g.FillPolygon($fg, (RectPoints $m[0] $m[1] $m[2] $m[3]))

  # 左侧括号
  $pts = New-Object 'System.Drawing.PointF[]' $script:MarkBracket.Count
  for ($i = 0; $i -lt $script:MarkBracket.Count; $i++) {
    $pts[$i] = New-Object System.Drawing.PointF((MapX $script:MarkBracket[$i][0]), (MapY $script:MarkBracket[$i][1]))
  }
  $g.FillPolygon($fg, $pts)

  # 15% 透明斜杠(先画,再被双眼覆盖)
  $slashCol = [System.Drawing.Color]::FromArgb(38, $fgCol.R, $fgCol.G, $fgCol.B)
  $slash = New-Object System.Drawing.SolidBrush($slashCol)
  $pts2 = New-Object 'System.Drawing.PointF[]' $script:MarkSlash.Count
  for ($i = 0; $i -lt $script:MarkSlash.Count; $i++) {
    $pts2[$i] = New-Object System.Drawing.PointF((MapX $script:MarkSlash[$i][0]), (MapY $script:MarkSlash[$i][1]))
  }
  $g.FillPolygon($slash, $pts2)
  $slash.Dispose()

  # 双眼
  foreach ($eye in $script:MarkEyes) {
    $g.FillPolygon($fg, (RectPoints $eye[0] $eye[1] $eye[2] $eye[3]))
  }

  $fg.Dispose()
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

Write-Host "Logo icons generated in $iconDir"
Write-Host "Run 'npm run icons' to let Tauri generate icon.ico / icon.icns from icon.png"
