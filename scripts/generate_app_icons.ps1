# Builds the Android/iOS icon assets from the GAINER brand mark.
#
# The mark ships as a black rounded square with a white G on a white page
# (assets/branding/gainer-app-icon.png). Adaptive icons need the mark alone on
# a transparent background, so this:
#   1. flood-fills the white page in from the borders and drops it,
#   2. keeps the white that survives - that is the G - using luminance as the
#      alpha mask, which preserves the antialiased edges,
#   3. crops to the mark and re-centres it at the size each asset wants.
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate_app_icons.ps1
#
# Re-run after replacing gainer-app-icon.png, then `npx expo prebuild
# --platform android` so the generated android/ picks the new assets up.

Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;

public static class MarkExtractor {
  /// Returns BGRA bytes for the mark: white with luminance as alpha.
  ///
  /// The source is a mark inside a dark tile on a light page, so the background
  /// is peeled off in two passes from the image border: first the light page,
  /// then the dark tile it exposes. Whatever survives is enclosed by the tile -
  /// that is the mark, and nothing else can be.
  public static byte[] Extract(byte[] src, int width, int height, int stride, out int minX, out int minY, out int maxX, out int maxY) {
    int count = width * height;
    int[] lum = new int[count];
    for (int y = 0; y < height; y++) {
      int row = y * stride;
      for (int x = 0; x < width; x++) {
        int i = row + x * 4;
        int value = (int)(0.299 * src[i + 2] + 0.587 * src[i + 1] + 0.114 * src[i]);
        // Fully transparent source pixels read as page, whatever their colour.
        lum[y * width + x] = src[i + 3] < 24 ? 255 : value;
      }
    }

    bool[] background = new bool[count];
    var queue = new Queue<int>();

    // Pass 1: the light page, flooded in from the border.
    for (int x = 0; x < width; x++) {
      Seed(lum, background, queue, width, x, 0, 170, true);
      Seed(lum, background, queue, width, x, height - 1, 170, true);
    }
    for (int y = 0; y < height; y++) {
      Seed(lum, background, queue, width, 0, y, 170, true);
      Seed(lum, background, queue, width, width - 1, y, 170, true);
    }
    Flood(lum, background, queue, width, height, 170, true);

    // Pass 2: everything the page now touches that is not near-white. This eats
    // the tile and its antialiased rim, and stops at the mark's solid core.
    for (int index = 0; index < count; index++) {
      if (!background[index]) continue;
      int x = index % width;
      int y = index / width;

      if (x > 0) Seed(lum, background, queue, width, x - 1, y, 240, false);
      if (x < width - 1) Seed(lum, background, queue, width, x + 1, y, 240, false);
      if (y > 0) Seed(lum, background, queue, width, x, y - 1, 240, false);
      if (y < height - 1) Seed(lum, background, queue, width, x, y + 1, 240, false);
    }
    Flood(lum, background, queue, width, height, 240, false);

    // Pass 2 also ate the mark's own soft edge. Give it back: a background pixel
    // within two of the core keeps its luminance as alpha, so the mark stays
    // smooth while the tile rim - which is nowhere near the core - stays gone.
    byte[] outBytes = new byte[stride * height];
    minX = width; minY = height; maxX = -1; maxY = -1;

    for (int y = 0; y < height; y++) {
      int row = y * stride;
      for (int x = 0; x < width; x++) {
        int i = row + x * 4;
        int index = y * width + x;
        int alpha = background[index] ? (NearCore(background, width, height, x, y, 2) ? lum[index] : 0) : 255;

        outBytes[i] = 255;
        outBytes[i + 1] = 255;
        outBytes[i + 2] = 255;
        outBytes[i + 3] = (byte)alpha;

        if (alpha > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    return outBytes;
  }

  private static bool NearCore(bool[] background, int width, int height, int x, int y, int radius) {
    int x0 = Math.Max(0, x - radius);
    int x1 = Math.Min(width - 1, x + radius);
    int y0 = Math.Max(0, y - radius);
    int y1 = Math.Min(height - 1, y + radius);

    for (int yy = y0; yy <= y1; yy++) {
      int row = yy * width;
      for (int xx = x0; xx <= x1; xx++) {
        if (!background[row + xx]) return true;
      }
    }

    return false;
  }

  private static void Flood(int[] lum, bool[] background, Queue<int> queue, int width, int height, int threshold, bool brighterThan) {
    while (queue.Count > 0) {
      int index = queue.Dequeue();
      int x = index % width;
      int y = index / width;

      if (x > 0) Seed(lum, background, queue, width, x - 1, y, threshold, brighterThan);
      if (x < width - 1) Seed(lum, background, queue, width, x + 1, y, threshold, brighterThan);
      if (y > 0) Seed(lum, background, queue, width, x, y - 1, threshold, brighterThan);
      if (y < height - 1) Seed(lum, background, queue, width, x, y + 1, threshold, brighterThan);
    }
  }

  private static void Seed(int[] lum, bool[] background, Queue<int> queue, int width, int x, int y, int threshold, bool brighterThan) {
    int index = y * width + x;
    if (background[index]) return;

    bool matches = brighterThan ? lum[index] > threshold : lum[index] < threshold;
    if (matches) {
      background[index] = true;
      queue.Enqueue(index);
    }
  }
}
'@

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'assets\branding\gainer-app-icon.png'
$assets = Join-Path $root 'assets'

# Brand black, matching android/app/src/main/res/values/colors.xml iconBackground.
$brandBlack = [System.Drawing.Color]::FromArgb(255, 11, 13, 16)
$canvas = 1024

# Android crops adaptive icons to a circle covering the middle ~66% of the
# canvas. A square-ish mark only fits inside that circle if it stays under
# 66% / sqrt(2) = 47%, so anything larger gets its corners shaved by the mask.
$adaptiveScale = 0.45
# The plain square icon has no crop, so the mark can sit larger.
$squareScale = 0.68

function Get-MarkBitmap {
  param([string]$Path)

  $src = [System.Drawing.Bitmap]::FromFile($Path)
  $w = $src.Width
  $h = $src.Height

  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $stride = $data.Stride
  $src.UnlockBits($data)
  $src.Dispose()

  $minX = 0; $minY = 0; $maxX = 0; $maxY = 0
  $outBytes = [MarkExtractor]::Extract($bytes, $w, $h, $stride, [ref]$minX, [ref]$minY, [ref]$maxX, [ref]$maxY)

  if ($maxX -lt 0) { throw "No mark found in $Path - is it still white on black?" }

  $out = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $outData = $out.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  [System.Runtime.InteropServices.Marshal]::Copy($outBytes, 0, $outData.Scan0, $outBytes.Length)
  $out.UnlockBits($outData)

  $cropRect = New-Object System.Drawing.Rectangle $minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1)
  $cropped = $out.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $out.Dispose()
  return $cropped
}

function Save-Icon {
  param(
    [System.Drawing.Bitmap]$Mark,
    [string]$Path,
    [int]$Size,
    [double]$Scale,
    [System.Drawing.Color]$Background,
    [switch]$Transparent
  )

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($Transparent) {
    $gfx.Clear([System.Drawing.Color]::Transparent)
  } else {
    $gfx.Clear($Background)
  }

  if ($Scale -gt 0) {
    $target = $Size * $Scale
    $ratio = [Math]::Min($target / $Mark.Width, $target / $Mark.Height)
    $drawW = $Mark.Width * $ratio
    $drawH = $Mark.Height * $ratio
    $gfx.DrawImage($Mark, ($Size - $drawW) / 2, ($Size - $drawH) / 2, $drawW, $drawH)
  }

  $gfx.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $Path"
}

$mark = Get-MarkBitmap -Path $source
Write-Host "mark extracted: $($mark.Width)x$($mark.Height)"

# Adaptive icon: mark alone on transparent, brand black behind it.
Save-Icon -Mark $mark -Path (Join-Path $assets 'android-icon-foreground.png') -Size $canvas -Scale $adaptiveScale -Background $brandBlack -Transparent
Save-Icon -Mark $mark -Path (Join-Path $assets 'android-icon-background.png') -Size $canvas -Scale 0 -Background $brandBlack
# Themed icons: Android tints the silhouette, so it ships white on transparent.
Save-Icon -Mark $mark -Path (Join-Path $assets 'android-icon-monochrome.png') -Size $canvas -Scale $adaptiveScale -Background $brandBlack -Transparent
# Square icon (iOS + stores) and the web favicon.
Save-Icon -Mark $mark -Path (Join-Path $assets 'icon.png') -Size $canvas -Scale $squareScale -Background $brandBlack
Save-Icon -Mark $mark -Path (Join-Path $assets 'favicon.png') -Size 96 -Scale $squareScale -Background $brandBlack

$mark.Dispose()
Write-Host 'done - next: npx expo prebuild --platform android, then npm run android'
