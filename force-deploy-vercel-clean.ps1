# ================================
# FORCE DEPLOY LOCAL -> GITHUB / VERCEL CLEAN
# Sobrescreve a branch main do GitHub
# Remove node_modules/dist do Git
# Corrige registry npm para Vercel
# Valida build local antes do push
# ================================

$ErrorActionPreference = "Stop"

# Ajuste aqui se precisar
$RepoUrl = "https://github.com/chronos15/RiderAdmin.git"
$Branch = "main"
$CommitMessage = "Corrige deploy Vercel removendo node_modules do Git"

function Run-Ignore {
    param ([string]$Command)
    cmd.exe /c "$Command >nul 2>nul" | Out-Null
    $global:LASTEXITCODE = 0
}

function Git-Output {
    param ([string[]]$ArgsList)

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"

    try {
        $output = & git @ArgsList 2>$null
        if ($LASTEXITCODE -ne 0) { return "" }
        return ($output -join "`n").Trim()
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }
}

function Ensure-GitIgnoreLine {
    param ([string]$Line)

    if (!(Test-Path ".gitignore")) {
        New-Item ".gitignore" -ItemType File | Out-Null
    }

    $content = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue
    $escaped = [regex]::Escape($Line)

    if ($content -notmatch "(?m)^$escaped$") {
        Add-Content ".gitignore" $Line
    }
}

Write-Host ""
Write-Host "===============================" -ForegroundColor Cyan
Write-Host " FORCE DEPLOY LIMPO -> GITHUB" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path "package.json")) {
    Write-Host "ERRO: package.json não encontrado. Rode o script dentro da pasta raiz do projeto." -ForegroundColor Red
    exit 1
}

if (!(Test-Path ".git")) {
    Write-Host "Inicializando repositório Git..." -ForegroundColor Yellow
    git init
}

Write-Host "Limpando estados pendentes de merge/rebase/cherry-pick..." -ForegroundColor Yellow
Run-Ignore "git rebase --abort"
Run-Ignore "git merge --abort"
Run-Ignore "git cherry-pick --abort"
Run-Ignore "git am --abort"
Run-Ignore "git reset --mixed"

Write-Host "Garantindo branch main..." -ForegroundColor Yellow
$currentBranch = Git-Output @("rev-parse", "--abbrev-ref", "HEAD")

if ($currentBranch -eq "HEAD" -or [string]::IsNullOrWhiteSpace($currentBranch)) {
    git switch -C $Branch
}
elseif ($currentBranch -ne $Branch) {
    git branch -M $Branch
}

Write-Host "Configurando identidade Git..." -ForegroundColor Yellow
$userName = Git-Output @("config", "--global", "user.name")
$userEmail = Git-Output @("config", "--global", "user.email")

if ([string]::IsNullOrWhiteSpace($userName)) {
    git config --global user.name "Mauricio"
}

if ([string]::IsNullOrWhiteSpace($userEmail)) {
    git config --global user.email "nexusdevelop4@gmail.com"
}

Write-Host "Configurando remote origin..." -ForegroundColor Yellow
$originUrl = Git-Output @("remote", "get-url", "origin")

if ([string]::IsNullOrWhiteSpace($originUrl)) {
    git remote add origin $RepoUrl
}
else {
    git remote set-url origin $RepoUrl
}

Write-Host "Criando .npmrc correto para Vercel..." -ForegroundColor Yellow
@"
registry=https://registry.npmjs.org/
legacy-peer-deps=true
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
audit=false
fund=false
"@ | Set-Content ".npmrc" -Encoding UTF8

Write-Host "Ajustando .gitignore..." -ForegroundColor Yellow
Ensure-GitIgnoreLine "node_modules/"
Ensure-GitIgnoreLine "dist/"
Ensure-GitIgnoreLine ".vercel/"
Ensure-GitIgnoreLine ".env"
Ensure-GitIgnoreLine ".env.local"
Ensure-GitIgnoreLine "*.tsbuildinfo"
Ensure-GitIgnoreLine "npm-debug.log*"
Ensure-GitIgnoreLine ".DS_Store"

Write-Host "Removendo arquivos/pastas que nunca devem ir para o Git..." -ForegroundColor Yellow
Run-Ignore "git rm -r --cached --ignore-unmatch node_modules"
Run-Ignore "git rm -r --cached --ignore-unmatch dist"
Run-Ignore "git rm -r --cached --ignore-unmatch .vercel"
Run-Ignore "git rm --cached --ignore-unmatch tsconfig.tsbuildinfo"
Run-Ignore "git rm --cached --ignore-unmatch tsconfig.node.tsbuildinfo"

Remove-Item "tsconfig.tsbuildinfo" -Force -ErrorAction SilentlyContinue
Remove-Item "tsconfig.node.tsbuildinfo" -Force -ErrorAction SilentlyContinue
Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Verificando conflitos no package.json..." -ForegroundColor Yellow
$packageJsonRaw = Get-Content "package.json" -Raw

if ($packageJsonRaw -match "<<<<<<<|=======|>>>>>>>") {
    Write-Host ""
    Write-Host "ERRO: package.json ainda tem marca de conflito." -ForegroundColor Red
    Write-Host "Abra o package.json e remova as linhas <<<<<<<, ======= e >>>>>>> antes de continuar." -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "Validando package.json..." -ForegroundColor Yellow
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"

Write-Host "Removendo package-lock.json e node_modules locais..." -ForegroundColor Yellow
Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Limpando cache npm..." -ForegroundColor Yellow
npm cache clean --force

Write-Host "Instalando dependências com registry público..." -ForegroundColor Yellow
npm install --legacy-peer-deps --registry=https://registry.npmjs.org/

if (!(Test-Path "package-lock.json")) {
    Write-Host ""
    Write-Host "ERRO: package-lock.json não foi gerado." -ForegroundColor Red
    exit 1
}

Write-Host "Verificando se package-lock.json ficou limpo..." -ForegroundColor Yellow
$badRegistry = Select-String -Path "package-lock.json" -Pattern "applied-caas|artifactory|internal.api.openai.org"

if ($badRegistry) {
    Write-Host ""
    Write-Host "ERRO: package-lock.json ainda contém registry interno inválido." -ForegroundColor Red
    Write-Host "Deploy na Vercel pode falhar. Processo interrompido." -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "Garantindo que node_modules/dist não serão enviados para o Git..." -ForegroundColor Yellow
Run-Ignore "git rm -r --cached --ignore-unmatch node_modules"
Run-Ignore "git rm -r --cached --ignore-unmatch dist"
Run-Ignore "git rm --cached --ignore-unmatch tsconfig.tsbuildinfo"
Run-Ignore "git rm --cached --ignore-unmatch tsconfig.node.tsbuildinfo"

$trackedNodeModules = Git-Output @("ls-files", "node_modules")
if (![string]::IsNullOrWhiteSpace($trackedNodeModules)) {
    Write-Host ""
    Write-Host "ERRO: node_modules ainda está rastreado pelo Git." -ForegroundColor Red
    Write-Host "Execute: git rm -r --cached node_modules" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$trackedDist = Git-Output @("ls-files", "dist")
if (![string]::IsNullOrWhiteSpace($trackedDist)) {
    Write-Host ""
    Write-Host "ERRO: dist ainda está rastreado pelo Git." -ForegroundColor Red
    Write-Host "Execute: git rm -r --cached dist" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Validando build local..." -ForegroundColor Yellow
npm run build

Write-Host "Removendo dist gerado pelo build local antes do commit..." -ForegroundColor Yellow
Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue
Run-Ignore "git rm -r --cached --ignore-unmatch dist"

Write-Host "Preparando commit..." -ForegroundColor Yellow
git add -A

$hasChanges = Git-Output @("status", "--porcelain")

if ([string]::IsNullOrWhiteSpace($hasChanges)) {
    Write-Host "Nenhuma alteração nova para commitar." -ForegroundColor Green
}
else {
    git commit -m $CommitMessage
}

Write-Host ""
Write-Host "Enviando para GitHub com FORCE PUSH..." -ForegroundColor Yellow
git push origin $Branch --force

Write-Host ""
Write-Host "===============================" -ForegroundColor Green
Write-Host " FINALIZADO COM SUCESSO" -ForegroundColor Green
Write-Host " GitHub sobrescrito pela branch local main" -ForegroundColor Green
Write-Host " Agora faça redeploy na Vercel limpando o cache" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
Write-Host ""
