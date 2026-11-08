# 从 .docx 提取纯文本（Windows PowerShell 7）
# 用法: pwsh -File scripts/extract_docx_text.ps1 -Docx data/raw/大语题库.docx -Out data/raw/大语题库.txt
param(
  [Parameter(Mandatory=$true)][string]$Docx,
  [Parameter(Mandatory=$true)][string]$Out
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Docx))
try {
  $entry = $zip.GetEntry('word/document.xml')
  $sr = New-Object IO.StreamReader($entry.Open())
  $xml = $sr.ReadToEnd(); $sr.Close()
} finally { $zip.Dispose() }
$t = $xml -replace '<w:tab/>', "`t" -replace '<w:br/>', "`n" -replace '</w:p>', "`n" -replace '</w:tc>', "`t" -replace '</w:tr>', "`n" -replace '<[^>]+>', ''
$t = $t -replace '&amp;','&' -replace '&lt;','<' -replace '&gt;','>' -replace '&quot;','"' -replace '&apos;',"'" -replace "`r",''
[IO.File]::WriteAllText((Join-Path (Get-Location) $Out), $t, (New-Object Text.UTF8Encoding($false)))
Write-Output ("已写入 $Out (" + $t.Length + " 字符)")
