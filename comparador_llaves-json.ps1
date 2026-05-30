# Ruta del archivo (ajústala si es necesario)
$file = "C:\Users\PcVIP\Documents\Projects\test-maker\public\assets\master-data.json"

# Leer todo el contenido como un solo string
$content = Get-Content $file -Raw

# Extraer solo los caracteres que nos interesan: { } [ ]
$tokens = $content.ToCharArray() | Where-Object { $_ -in '(', ')', '[', ']', '{', '}' }

# Mostrar la secuencia completa en una línea
Write-Host "Secuencia de caracteres de agrupación:" -ForegroundColor Cyan
$secuencia = -join $tokens
Write-Host $secuencia -ForegroundColor Yellow

# Contar aperturas y cierres
$openBraces = ($secuencia -replace "[^{]", "").Length
$closeBraces = ($secuencia -replace "[^}]", "").Length
$openBrackets = ($secuencia -replace "[^[]", "").Length
$closeBrackets = ($secuencia -replace "[^]]", "").Length

Write-Host "`nEstadísticas:" -ForegroundColor Cyan
Write-Host "Llaves `{` : $openBraces  |  Llaves `}` : $closeBraces   -> Diferencia: $($openBraces - $closeBraces)"
Write-Host "Corchetes `[` : $openBrackets | Corchetes `]` : $closeBrackets -> Diferencia: $($openBrackets - $closeBrackets)"

if ($openBraces -ne $closeBraces) { Write-Host "ERROR: Desajuste en llaves." -ForegroundColor Red }
if ($openBrackets -ne $closeBrackets) { Write-Host "ERROR: Desajuste en corchetes." -ForegroundColor Red }