# Renders every app-icon asset from the one vector source.
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate_app_icons.ps1
#
# The source of record is assets/branding/vinha-icon.svg: a purple V on the ink
# field, split by two thin cuts — it moves so fast it tears. The numbers below
# mirror that file exactly, and tests/lib/appIcon.test.cjs fails if the two ever
# disagree, because a renderer that has quietly drifted from its design source
# still produces a plausible-looking icon.
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

$FIELD = [System.Drawing.Color]::FromArgb(255, 0x10, 0x18, 0x28)   # #101828
$GLYPH = [System.Drawing.Color]::FromArgb(255, 0x8B, 0x5C, 0xF6)   # #8B5CF6
$CANVAS = 1024.0

# M330 264 L512 724 L694 264 — the V, stroked, not filled.
$V_POINTS = @(
  (New-Object System.Drawing.PointF 330, 264),
  (New-Object System.Drawing.PointF 512, 724),
  (New-Object System.Drawing.PointF 694, 264)
)
$STROKE = 126.0
$SKEW_DEG = -7.0
$SHIFT_X = 36.0

# Two 30-unit bands across the whole canvas, rotated together.
$CUT_ROTATION_DEG = -16.0
$CUT_TOPS = @(392.0, 606.0)
$CUT_HEIGHT = 30.0
$CUT_X = -120.0
$CUT_WIDTH = 1264.0

# Android shows the middle 72 of a 108 foreground layer. Scaling the WHOLE
# composition by that ratio — not re-centring the glyph — is what keeps the
# masked Android icon looking like the iOS tile instead of a zoomed-in crop.
$ADAPTIVE_SCALE = 72.0 / 108.0

# --- rendering ------------------------------------------------------------

function New-GlyphTransform {
  param([double]$Size, [double]$Scale)

  # SVG applies transform="skewX(-7) translate(36 0)" right to left, so a point
  # is translated first and skewed second.
  $skew = [Math]::Tan($SKEW_DEG * [Math]::PI / 180.0)
  $m = New-Object System.Drawing.Drawing2D.Matrix 1, 0, $skew, 1, 0, 0
  $m.Translate($SHIFT_X, 0, [System.Drawing.Drawing2D.MatrixOrder]::Prepend)

  $fit = New-Object System.Drawing.Drawing2D.Matrix
  $fit.Translate($Size / 2, $Size / 2)
  $fit.Scale(($Size / $CANVAS) * $Scale, ($Size / $CANVAS) * $Scale)
  $fit.Translate(-$CANVAS / 2, -$CANVAS / 2)
  $fit.Multiply($m)
  return $fit
}

function New-CutTransform {
  param([double]$Size, [double]$Scale)

  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate($Size / 2, $Size / 2)
  $m.Scale(($Size / $CANVAS) * $Scale, ($Size / $CANVAS) * $Scale)
  $m.Translate(-$CANVAS / 2, -$CANVAS / 2)
  # The cuts live in the root space, outside the glyph's own skew: they are the
  # mask on the group, not part of the path.
  $m.RotateAt($CUT_ROTATION_DEG, (New-Object System.Drawing.PointF 512, 512))
  return $m
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

function Draw-Cuts {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Color]$Color,
    [double]$Size,
    [double]$Scale
  )

  $brush = New-Object System.Drawing.SolidBrush $Color
  $saved = $Graphics.Transform
  $Graphics.Transform = New-CutTransform -Size $Size -Scale $Scale
  foreach ($top in $CUT_TOPS) {
    $Graphics.FillRectangle($brush, $CUT_X, $top, $CUT_WIDTH, $CUT_HEIGHT)
  }
  $Graphics.Transform = $saved
  $brush.Dispose()
}

function Save-Opaque {
  param([string]$Path, [int]$Size, [double]$Scale = 1.0, [switch]$NoCuts)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = New-Graphics -Bitmap $bmp
  $g.Clear($FIELD)
  Draw-Glyph -Graphics $g -Color $GLYPH -Size $Size -Scale $Scale
  # On an opaque tile the cuts are just field-coloured bands painted back over
  # the V — no masking needed, and the antialiasing stays exact.
  if (-not $NoCuts) { Draw-Cuts -Graphics $g -Color $FIELD -Size $Size -Scale $Scale }
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $Path ($Size, opaque)"
}

function Save-Glyph {
  param([string]$Path, [int]$Size, [double]$Scale, [System.Drawing.Color]$Color, [switch]$NoCuts)

  # Built in luminance and converted to alpha at the end. Punching the cuts out
  # of an already-transparent bitmap would need SourceCopy, which cannot blend —
  # every cut edge would come out jagged. White-on-black antialiases correctly
  # for BOTH the V and the cuts, and luminance is then exactly the coverage.
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = New-Graphics -Bitmap $bmp
  $g.Clear([System.Drawing.Color]::Black)
  Draw-Glyph -Graphics $g -Color ([System.Drawing.Color]::White) -Size $Size -Scale $Scale
  if (-not $NoCuts) { Draw-Cuts -Graphics $g -Color ([System.Drawing.Color]::Black) -Size $Size -Scale $Scale }
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
# Themed icons: Android tints the silhouette, so it ships white.
Save-Glyph -Path (Join-Path $assets 'android-icon-monochrome.png') -Size 1024 -Scale $ADAPTIVE_SCALE -Color ([System.Drawing.Color]::White)

# Below ~40px the cuts close up and the V turns to mud, so the small marks ship
# solid — the design's own rule, and it is the difference between a readable
# glyph and a purple smudge in a browser tab or a status bar.
Save-Opaque -Path (Join-Path $assets 'favicon.png') -Size 96 -NoCuts
Save-Glyph -Path (Join-Path $assets 'notification-icon.png') -Size 96 -Scale 0.72 -Color ([System.Drawing.Color]::White) -NoCuts

Write-Host ''
Write-Host 'done - next: npx expo prebuild --platform android, then npm run android'
