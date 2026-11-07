<#
  Generates the original payment-card artwork used by the "Personal Finance Hub" template
  (src/data/templates/finance/images/card-*.jpg). Fictional brand ("Ember"), masked numbers,
  no real card-network logos. Run from the repository root:

    powershell -ExecutionPolicy Bypass -File scripts/generate-card-art.ps1
#>
param([string]$OutDir = 'src/data/templates/finance/images')

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutDir | Out-Null

$W = 640; $H = 400
# Background behind the rounded card = the Midnight Ember surface colour, so the JPEG blends into its tile.
$surface = [System.Drawing.ColorTranslator]::FromHtml('#17171A')

$cards = @(
  @{ name = 'card-ember';    from = '#FF7A3D'; mid = '#E2452A'; to = '#3B1418'; kind = 'DEBIT';  number = '4821'; holder = 'JORDAN ELLIS'; expiry = '08/29' },
  @{ name = 'card-graphite'; from = '#5A5A62'; mid = '#2E2E34'; to = '#121215'; kind = 'CREDIT'; number = '7305'; holder = 'JORDAN ELLIS'; expiry = '03/28' },
  @{ name = 'card-ocean';    from = '#3FA9F5'; mid = '#1E6FD9'; to = '#0B2A5B'; kind = 'TRAVEL'; number = '1946'; holder = 'SAM ELLIS';    expiry = '11/27' }
)

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90)
  $p.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
  $p.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $p.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $p.CloseFigure()
  return $p
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]82)

foreach ($c in $cards) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($surface)

  $m = 16
  $card = New-RoundedPath $m $m ($W - 2 * $m) ($H - 2 * $m) 28
  $rect = New-Object System.Drawing.RectangleF $m, $m, ($W - 2 * $m), ($H - 2 * $m)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::Black), ([System.Drawing.Color]::Black), 35.0
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $blend.Colors = @([System.Drawing.ColorTranslator]::FromHtml($c.from), [System.Drawing.ColorTranslator]::FromHtml($c.mid), [System.Drawing.ColorTranslator]::FromHtml($c.to))
  $blend.Positions = @([single]0, [single]0.45, [single]1)
  $brush.InterpolationColors = $blend
  $g.FillPath($brush, $card)

  # Soft light sweep across the card.
  $g.SetClip($card)
  $sheen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
  $g.FillEllipse($sheen, 260, -180, 520, 420)
  $g.ResetClip()

  $white = [System.Drawing.Brushes]::White
  $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190, 255, 255, 255))

  # Brand mark: two concentric rings + wordmark.
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 4
  $g.DrawEllipse($pen, 48, 46, 40, 40)
  $g.DrawEllipse($pen, 58, 56, 20, 20)
  $g.DrawString('Ember', (New-Object System.Drawing.Font 'Segoe UI Semibold', 20), $white, 98, 47)
  $kindFont = New-Object System.Drawing.Font 'Segoe UI', 16, ([System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic)
  $kindSize = $g.MeasureString($c.kind, $kindFont)
  $g.DrawString($c.kind, $kindFont, $white, ($W - 48 - $kindSize.Width), 52)

  # Chip.
  $chip = New-RoundedPath 52 128 62 46 8
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#E8C77A'))), $chip)
  $chipPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 120, 90, 30)), 2
  $g.DrawLine($chipPen, 52, 151, 114, 151); $g.DrawLine($chipPen, 83, 128, 83, 174)

  # Masked number, holder and expiry.
  $dots = ([string][char]0x2022) * 4
  $g.DrawString(("{0}   {0}   {0}   {1}" -f $dots, $c.number), (New-Object System.Drawing.Font 'Consolas', 26, ([System.Drawing.FontStyle]::Bold)), $white, 48, 206)
  $label = New-Object System.Drawing.Font 'Segoe UI', 10
  $value = New-Object System.Drawing.Font 'Segoe UI Semibold', 15
  $g.DrawString('CARD HOLDER', $label, $soft, 50, 290)
  $g.DrawString($c.holder, $value, $white, 48, 308)
  $g.DrawString('EXPIRES', $label, $soft, 300, 290)
  $g.DrawString($c.expiry, $value, $white, 298, 308)

  # Contactless waves.
  $wave = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 255, 255, 255)), 3
  foreach ($i in 0..2) { $r = 10 + 9 * $i; $g.DrawArc($wave, (540 - $r), (318 - $r), 2 * $r, 2 * $r, -50, 100) }

  $out = Join-Path $OutDir "$($c.name).jpg"
  $bmp.Save($out, $codec, $ep)
  $g.Dispose(); $bmp.Dispose()
  '{0,-16} {1,7:N0} bytes' -f $c.name, (Get-Item $out).Length
}
