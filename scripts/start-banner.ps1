# Laravel-style console banner for Treez Sync (ASCII only - safe on all Windows encodings)
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Header", "Info", "Success", "Warn", "Error", "Line", "Footer", "Url")]
    [string] $Mode,
    [string] $Text = ""
)

$Host.UI.RawUI.WindowTitle = "Treez Sync | Opticon ESL"

switch ($Mode) {
    "Header" {
        $W = 70
        function Row-Empty {
            Write-Host ("  |" + (" " * $W) + "|") -ForegroundColor DarkCyan
        }
        function Row-Centered([string]$content, [string]$fg = "White") {
            if ($content.Length -gt $W) { $content = $content.Substring(0, $W) }
            $pad = $W - $content.Length
            $L = [Math]::Floor($pad / 2)
            $R = $pad - $L
            $inner = (" " * $L) + $content + (" " * $R)
            Write-Host "  |" -NoNewline -ForegroundColor DarkCyan
            Write-Host $inner -NoNewline -ForegroundColor $fg
            Write-Host "|" -ForegroundColor DarkCyan
        }

        Write-Host ""
        Write-Host ("  +" + ("-" * $W) + "+") -ForegroundColor DarkCyan
        Row-Empty
        Row-Centered "PERFECT UNION" "Cyan"
        Row-Empty
        Row-Centered "Treez Sync Middleware" "White"
        Row-Centered "Next.js  *  Opticon EBS50" "DarkGray"
        Row-Empty
        Row-Centered "Treez  ->  Supabase  ->  Opticon" "DarkGray"
        Row-Empty
        Write-Host ("  +" + ("-" * $W) + "+") -ForegroundColor DarkCyan
        Write-Host ""
        Write-Host "  Environment" -ForegroundColor DarkGray
        Write-Host ""
    }
    "Info" {
        Write-Host "  INFO  " -NoNewline -ForegroundColor Cyan
        Write-Host $Text -ForegroundColor Gray
    }
    "Success" {
        Write-Host "  DONE  " -NoNewline -ForegroundColor Green
        Write-Host $Text -ForegroundColor Gray
    }
    "Warn" {
        Write-Host "  WARN  " -NoNewline -ForegroundColor Yellow
        Write-Host $Text -ForegroundColor Gray
    }
    "Error" {
        Write-Host ""
        Write-Host "  ERROR " -NoNewline -ForegroundColor Red
        Write-Host $Text -ForegroundColor Red
        Write-Host ""
    }
    "Line" {
        Write-Host "  --------------------------------------------------------------------" -ForegroundColor DarkGray
    }
    "Footer" {
        Write-Host ""
        Write-Host "  Application ready. Press Ctrl+C to stop the server." -ForegroundColor DarkGray
        Write-Host ""
    }
    "Url" {
        Write-Host "  Local URL " -NoNewline -ForegroundColor DarkGray
        Write-Host $Text -ForegroundColor Green
        Write-Host ""
    }
}
