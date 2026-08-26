# Renders every app-icon asset from the one vector source.
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate_app_icons.ps1
#
# The source of record is assets/branding/vinha-icon.svg: a white V, tilted 8°,
# on a full orange field. The numbers below mirror that file exactly, and
# tests/lib/appIcon.test.cjs fails if the two ever disagree, because a renderer
# that has quietly drifted from its design source still produces a
# plausible-looking icon.
#
# Chosen from eight prototypes (user 2026-08-26, "paras on E tai F"). The ink
# field it replaces was the actual complaint: a dark tile sits among every other
# dark tile on a home screen, so the icon was hard to find rather than boring in
# itself. Colour the whole field and the mark is the size of the icon.
#
# Two earlier ideas are gone with it. The lean used to be a skew — vertical
# edges falling while horizontals stayed — which read as italic; this is a
# rotation, so the V keeps its own angles. And two thin cuts crossed the glyph:
# they closed up below 40px and turned it to mud.
#
# Why a renderer and not just the PNG exports: Android's adaptive icon needs the
# glyph ALONE on transparency, scaled into the mask's safe zone. No exported
# square can be cropped into that, and every attempt to derive it from a bitmap
# is a guess about which pixels are background.
#
# After running: npx expo prebuild --platform android, then npm run android.
# (prebuild wipes android/local.properties — restore it before Gradle runs.)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
$branding = Join-Path $assets 'branding'

# --- the source geometry, in the SVG's 1024 space -------------------------

$FIELD = [System.Drawing.Color]::FromArgb(255, 0xFF, 0x8A, 0x4C)   # #FF8A4C
$GLYPH = [System.Drawing.Color]::FromArgb(255, 0xFF, 0xFF, 0xFF)   # #FFFFFF
$CANVAS = 1024.0

# M270 230 L512 680 L754 230 — the V, stroked, not filled.
$V_POINTS = @(
  (New-Object System.Drawing.PointF 270, 230),
  (New-Object System.Drawing.PointF 512, 680),
  (New-Object System.Drawing.PointF 754, 230)
)
$STROKE = 150.0

# Rotated, not skewed: the whole glyph turns, so the mitre at the vertex and the
# flat caps keep the angles the path gives them.
$TILT_DEG = -8.0

# Android shows the middle 72 of a 108 foreground layer. Scaling the WHOLE
# composition by that ratio — not re-centring the glyph — is what keeps the
# masked Android icon looking like the iOS tile instead of a zoomed-in crop.
$ADAPTIVE_SCALE = 72.0 / 108.0

# --- rendering ------------------------------------------------------------

function New-GlyphTransform {
  param([double]$Size, [double]$Scale)

  $fit = New-Object System.Drawing.Drawing2D.Matrix
  $fit.Translate($Size / 2, $Size / 2)
  $fit.Scale(($Size / $CANVAS) * $Scale, ($Size / $CANVAS) * $Scale)
  $fit.Translate(-$CANVAS / 2, -$CANVAS / 2)
  # About the canvas centre, matching transform="rotate(-8 512 512)".
  $fit.RotateAt($TILT_DEG, (New-Object System.Drawing.PointF 512, 512))
  return $fit
}

function New-Graphics {
  param([System.Drawing.Bitmap]$Bitmap)

  $g = [System.Drawing.Graphics]::FromImage($Bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return $g
}

function Draw-Glyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Color]$Color,
    [double]$Size,
    [double]$Scale
  )

  $pen = New-Object System.Drawing.Pen $Color, $STROKE
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Miter
  $pen.MiterLimit = 4
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat

  $saved = $Graphics.Transform
  $Graphics.Transform = New-GlyphTransform -Size $Size -Scale $Scale
  $Graphics.DrawLines($pen, $V_POINTS)
  $Graphics.Transform = $saved
  $pen.Dispose()
}

function Save-Opaque {
  param([string]$Path, [int]$Size, [double]$Scale = 1.0)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = New-Graphics -Bitmap $bmp
  $g.Clear($FIELD)
  Draw-Glyph -Graphics $g -Color $GLYPH -Size $Size -Scale $Scale
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $Path ($Size, opaque)"
}

function Save-Glyph {
  param(
    [string]$Path,
    [int]$Size,
    [double]$Scale,
    [System.Drawing.Color]$Color
  )

  # Built in luminance and converted to alpha at the end. Drawing straight onto
  # transparency would need SourceCopy, which cannot blend, and every edge would
  # come out jagged. White on black antialiases correctly, and luminance is then
  # exactly the coverage.
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = New-Graphics -Bitmap $bmp
  $g.Clear([System.Drawing.Color]::Black)
  Draw-Glyph -Graphics $g -Color ([System.Drawing.Color]::White) -Size $Size -Scale $Scale
  $g.Dispose()

  $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $Size)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  for ($i = 0; $i -lt $bytes.Length; $i += 4) {
    $bytes[$i + 3] = $bytes[$i + 1]   # green channel == coverage for white on black
    $bytes[$i] = $Color.B
    $bytes[$i + 1] = $Color.G
    $bytes[$i + 2] = $Color.R
  }
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
  $bmp.UnlockBits($data)

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $Path ($Size, glyph only)"
}

# --- the assets -----------------------------------------------------------

# iOS / Expo master. Square, opaque, no rounding: Apple rounds it itself.
Save-Opaque -Path (Join-Path $assets 'icon.png') -Size 1024
# Play Console listing.
Save-Opaque -Path (Join-Path $branding 'vinha-play-store-512.png') -Size 512
# The tile the Health Connect screen shows next to the health app's icon.
Save-Opaque -Path (Join-Path $branding 'vinha-app-icon.png') -Size 256

# Android adaptive: glyph on transparency, field supplied by backgroundColor.
Save-Glyph -Path (Join-Path $assets 'android-icon-foreground.png') -Size 1024 -Scale $ADAPTIVE_SCALE -Color $GLYPH
# Themed icons: Android tints the silhouette itself, so it ships as one white
# shape. Two colours here would be repainted anyway.
Save-Glyph -Path (Join-Path $assets 'android-icon-monochrome.png') -Size 1024 -Scale $ADAPTIVE_SCALE -Color ([System.Drawing.Color]::White)

# The small marks. The V is one shape at every size now, so these are the same
# drawing rather than a solid stand-in for one that fell apart when shrunk.
Save-Opaque -Path (Join-Path $assets 'favicon.png') -Size 96
Save-Glyph -Path (Join-Path $assets 'notification-icon.png') -Size 96 -Scale 0.72 -Color ([System.Drawing.Color]::White)

Write-Host ''
Write-Host 'done - next: npx expo prebuild --platform android, then npm run android'
