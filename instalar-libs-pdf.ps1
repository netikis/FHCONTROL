# Baixa as bibliotecas de PDF para uso offline (pasta lib)
$dir = Join-Path $PSScriptRoot "lib"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$fontes = @{
    "html2canvas.min.js" = @(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
    )
    "jspdf.umd.min.js" = @(
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
        "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"
    )
}

foreach ($nome in $fontes.Keys) {
    $dest = Join-Path $dir $nome
    $ok = $false
    foreach ($url in $fontes[$nome]) {
        Write-Host "Baixando $nome ... ($url)"
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
            if ((Get-Item $dest).Length -gt 1000) {
                Write-Host "OK: $dest ($((Get-Item $dest).Length) bytes)" -ForegroundColor Green
                $ok = $true
                break
            }
        } catch {
            Write-Host "Falhou: $_" -ForegroundColor Yellow
        }
    }
    if (-not $ok) {
        Write-Host "ERRO: nao foi possivel baixar $nome" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Concluido. Abra o index.html e pressione Ctrl+F5." -ForegroundColor Green
Read-Host "Pressione Enter para fechar"
