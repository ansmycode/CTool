$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere)) { throw 'Install Visual Studio C++ x86 tools and CMake.' }
$install = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $install) { throw 'Visual Studio C++ x86 tools not found.' }
$cmake = Join-Path $install 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
if (-not (Test-Path -LiteralPath $cmake)) { $cmake = (Get-Command cmake -ErrorAction Stop).Source }
$major = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationVersion).Split('.')[0]
$generator = switch ($major) { '16' { 'Visual Studio 16 2019' } '17' { 'Visual Studio 17 2022' } default { throw "Unsupported Visual Studio version: $major" } }
& $cmake -S "$repo/native" -B "$repo/native/build" -G $generator -A Win32
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $cmake --build "$repo/native/build" --config Release
exit $LASTEXITCODE

