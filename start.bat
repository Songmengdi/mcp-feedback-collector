@echo off
setlocal enabledelayedexpansion

REM MCP Feedback Collector 智能启动器 (Windows版)
REM 功能：环境检查、端口检测、自动配置、应用启动

REM 配置变量
set DEFAULT_WEB_PORT=5000
set DEFAULT_MCP_PORT=3001
set FIXED_TOOLBAR_PORT=5749
set MAX_PORT_ATTEMPTS=10
set PORT_RANGE_START=3001
set PORT_RANGE_END=3100

REM 颜色代码 (Windows 10+)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "PURPLE=[95m"
set "CYAN=[96m"
set "NC=[0m"

REM 启用颜色支持
for /f "tokens=2 delims=[]" %%i in ('ver') do set winver=%%i
for /f "tokens=2,3 delims=. " %%i in ("%winver%") do set /a major=%%i, minor=%%j
if %major% geq 10 (
    REM Windows 10+ 支持ANSI颜色
    set COLORS_ENABLED=1
) else (
    REM 旧版本Windows不支持颜色
    set COLORS_ENABLED=0
    set "RED="
    set "GREEN="
    set "YELLOW="
    set "BLUE="
    set "PURPLE="
    set "CYAN="
    set "NC="
)

REM 日志函数
:log_info
if "%COLORS_ENABLED%"=="1" (
    echo %BLUE%[INFO]%NC% %~1
) else (
    echo [INFO] %~1
)
goto :eof

:log_success
if "%COLORS_ENABLED%"=="1" (
    echo %GREEN%[SUCCESS]%NC% %~1
) else (
    echo [SUCCESS] %~1
)
goto :eof

:log_warning
if "%COLORS_ENABLED%"=="1" (
    echo %YELLOW%[WARNING]%NC% %~1
) else (
    echo [WARNING] %~1
)
goto :eof

:log_error
if "%COLORS_ENABLED%"=="1" (
    echo %RED%[ERROR]%NC% %~1
) else (
    echo [ERROR] %~1
)
goto :eof

:log_step
if "%COLORS_ENABLED%"=="1" (
    echo %PURPLE%[STEP]%NC% %~1
) else (
    echo [STEP] %~1
)
goto :eof

REM 显示启动横幅
:show_banner
if "%COLORS_ENABLED%"=="1" (
    echo %CYAN%
)
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                MCP Feedback Collector                        ║
echo ║                    智能启动器 v2.0 (Windows)                ║
echo ╚══════════════════════════════════════════════════════════════╝
if "%COLORS_ENABLED%"=="1" (
    echo %NC%
)
goto :eof

REM 检查命令是否存在
:check_command
where %1 >nul 2>&1
if errorlevel 1 (
    call :log_error "命令 '%1' 未找到，请先安装"
    exit /b 1
)
exit /b 0

REM 检查端口是否被占用
:check_port
netstat -an | findstr ":%1 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    exit /b 0
) else (
    exit /b 1
)

REM 查找可用端口
:find_available_port
set start_port=%1
set max_attempts=%2
if "%max_attempts%"=="" set max_attempts=%MAX_PORT_ATTEMPTS%

for /l %%i in (0,1,%max_attempts%) do (
    set /a port=!start_port! + %%i
    if !port! gtr %PORT_RANGE_END% goto :find_port_failed
    
    call :check_port !port!
    if not errorlevel 1 (
        echo !port!
        exit /b 0
    )
)

:find_port_failed
exit /b 1

REM 显示端口占用信息
:show_port_usage
call :log_warning "端口 %1 被占用，占用进程："
netstat -ano | findstr ":%1 " | findstr "LISTENING"
goto :eof

REM 杀死占用端口的进程
:kill_port_process
set port=%1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%port% " ^| findstr "LISTENING"') do (
    call :log_warning "正在终止占用端口 %port% 的进程: %%a"
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak >nul

call :check_port %port%
if not errorlevel 1 (
    call :log_success "端口 %port% 已释放"
    exit /b 0
) else (
    call :log_error "无法释放端口 %port%"
    exit /b 1
)

REM 环境检查
:check_environment
call :log_step "检查运行环境..."

REM 检查Node.js
call :check_command node
if errorlevel 1 (
    call :log_error "请先安装 Node.js (建议版本 >= 18)"
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set node_version=%%i
set node_version=%node_version:v=%
call :log_info "Node.js 版本: %node_version%"

REM 检查npm
call :check_command npm
if errorlevel 1 (
    call :log_error "请先安装 npm"
    exit /b 1
)

REM 检查项目文件
if not exist "package.json" (
    call :log_error "未找到 package.json，请在项目根目录运行此脚本"
    exit /b 1
)

REM 检查依赖
if not exist "node_modules" (
    call :log_warning "未找到 node_modules，正在安装依赖..."
    npm install
)

REM 检查构建文件
if not exist "dist" (
    call :log_warning "未找到构建文件，正在构建项目..."
    npm run build
)

call :log_success "环境检查完成"
goto :eof

REM 端口配置
:configure_ports
call :log_step "配置端口..."

REM Web端口配置
if "%MCP_WEB_PORT%"=="" set MCP_WEB_PORT=%DEFAULT_WEB_PORT%
set web_port=%MCP_WEB_PORT%

call :check_port %web_port%
if errorlevel 1 (
    call :show_port_usage %web_port%
    call :log_info "正在释放Web端口 %web_port%..."
    call :kill_port_process %web_port%
    if errorlevel 1 (
        call :find_available_port %web_port%
        if errorlevel 1 (
            call :log_error "无法找到可用的Web端口"
            exit /b 1
        )
        for /f %%i in ('call :find_available_port %web_port%') do set web_port=%%i
        call :log_info "使用替代Web端口: !web_port!"
    )
)
set MCP_WEB_PORT=%web_port%

REM MCP HTTP端口配置
if "%MCP_HTTP_PORT%"=="" set MCP_HTTP_PORT=%DEFAULT_MCP_PORT%
set mcp_port=%MCP_HTTP_PORT%

call :check_port %mcp_port%
if errorlevel 1 (
    call :show_port_usage %mcp_port%
    call :log_info "正在释放MCP端口 %mcp_port%..."
    call :kill_port_process %mcp_port%
    if errorlevel 1 (
        call :find_available_port %mcp_port%
        if errorlevel 1 (
            call :log_error "无法找到可用的MCP端口"
            exit /b 1
        )
        for /f %%i in ('call :find_available_port %mcp_port%') do set mcp_port=%%i
        call :log_info "使用替代MCP端口: !mcp_port!"
    )
)
set MCP_HTTP_PORT=%mcp_port%

REM Toolbar端口配置（固定端口5749）
set toolbar_port=%FIXED_TOOLBAR_PORT%
call :check_port %toolbar_port%
if errorlevel 1 (
    call :show_port_usage %toolbar_port%
    call :log_info "正在释放Toolbar端口 %toolbar_port%..."
    call :kill_port_process %toolbar_port%
    if errorlevel 1 (
        call :log_error "无法释放Toolbar端口 %toolbar_port%，该端口为固定端口"
        call :log_error "请手动释放端口 %toolbar_port% 后重试"
        exit /b 1
    )
)
set MCP_TOOLBAR_PORT=%toolbar_port%

call :log_success "端口配置完成"
call :log_info "Web端口: %MCP_WEB_PORT%"
call :log_info "MCP端口: %MCP_HTTP_PORT%"
call :log_info "Toolbar端口: %MCP_TOOLBAR_PORT% (固定)"
goto :eof

REM 设置传输模式
:configure_transport
call :log_step "配置传输模式..."

if "%MCP_TRANSPORT_MODE%"=="" set MCP_TRANSPORT_MODE=streamable_http
set transport_mode=%MCP_TRANSPORT_MODE%

if "%transport_mode%"=="streamable_http" (
    call :log_info "使用 StreamableHTTP 传输模式"
    if "%MCP_ENABLE_SSE_FALLBACK%"=="" set MCP_ENABLE_SSE_FALLBACK=true
) else if "%transport_mode%"=="sse" (
    call :log_info "使用 SSE 传输模式"
) else if "%transport_mode%"=="stdio" (
    call :log_info "使用 stdio 传输模式"
) else (
    call :log_warning "未知传输模式 '%transport_mode%'，使用默认模式 'streamable_http'"
    set MCP_TRANSPORT_MODE=streamable_http
)

call :log_success "传输模式配置完成"
goto :eof

REM 显示配置信息
:show_configuration
call :log_step "当前配置信息："
if "%COLORS_ENABLED%"=="1" (
    echo %CYAN%┌─────────────────────────────────────────┐%NC%
    echo %CYAN%│%NC%  配置项                值              %CYAN%│%NC%
    echo %CYAN%├─────────────────────────────────────────┤%NC%
    echo %CYAN%│%NC%  Web端口               %MCP_WEB_PORT%              %CYAN%│%NC%
    echo %CYAN%│%NC%  MCP端口               %MCP_HTTP_PORT%              %CYAN%│%NC%
    echo %CYAN%│%NC%  Toolbar端口           %MCP_TOOLBAR_PORT% ^(固定^)        %CYAN%│%NC%
    echo %CYAN%│%NC%  传输模式               %MCP_TRANSPORT_MODE%    %CYAN%│%NC%
    echo %CYAN%│%NC%  SSE回退               %MCP_ENABLE_SSE_FALLBACK%             %CYAN%│%NC%
    echo %CYAN%│%NC%  日志级别               %LOG_LEVEL%             %CYAN%│%NC%
    echo %CYAN%└─────────────────────────────────────────┘%NC%
) else (
    echo ┌─────────────────────────────────────────┐
    echo │  配置项                值              │
    echo ├─────────────────────────────────────────┤
    echo │  Web端口               %MCP_WEB_PORT%              │
    echo │  MCP端口               %MCP_HTTP_PORT%              │
    echo │  Toolbar端口           %MCP_TOOLBAR_PORT% ^(固定^)        │
    echo │  传输模式               %MCP_TRANSPORT_MODE%    │
    echo │  SSE回退               %MCP_ENABLE_SSE_FALLBACK%             │
    echo │  日志级别               %LOG_LEVEL%             │
    echo └─────────────────────────────────────────┘
)
goto :eof

REM 启动应用
:start_application
call :log_step "启动 MCP Feedback Collector..."

REM 设置其他环境变量
if "%MCP_CORS_ORIGIN%"=="" set MCP_CORS_ORIGIN=*
if "%MCP_CLEANUP_PORT_ON_START%"=="" set MCP_CLEANUP_PORT_ON_START=true
if "%MCP_USE_FIXED_URL%"=="" set MCP_USE_FIXED_URL=true

REM 创建日志目录
if not exist logs mkdir logs

REM 设置日志文件
set LOG_FILE=logs\mcp-feedback-collector.log
set PID_FILE=logs\mcp-feedback-collector.pid

REM 检查是否已经在运行
if exist "%PID_FILE%" (
    set /p EXISTING_PID=<"%PID_FILE%"
    tasklist /FI "PID eq !EXISTING_PID!" 2>nul | find "!EXISTING_PID!" >nul
    if not errorlevel 1 (
        call :log_error "服务器已在运行中 (PID: !EXISTING_PID!)"
        call :log_info "使用 'start.bat stop' 停止服务器"
        exit /b 1
    ) else (
        call :log_warning "发现过期的PID文件，正在清理..."
        del "%PID_FILE%" 2>nul
    )
)

REM 显示启动信息
if "%COLORS_ENABLED%"=="1" (
    echo %GREEN%🚀 正在启动服务器...%NC%
    echo %BLUE%📡 Web界面: http://localhost:%MCP_WEB_PORT%%NC%
    echo %BLUE%🔗 MCP API: http://localhost:%MCP_HTTP_PORT%/mcp%NC%
    
    if "%MCP_ENABLE_SSE_FALLBACK%"=="true" (
        echo %BLUE%📡 SSE端点: http://localhost:%MCP_HTTP_PORT%/sse%NC%
    )
) else (
    echo 🚀 正在启动服务器...
    echo 📡 Web界面: http://localhost:%MCP_WEB_PORT%
    echo 🔗 MCP API: http://localhost:%MCP_HTTP_PORT%/mcp
    
    if "%MCP_ENABLE_SSE_FALLBACK%"=="true" (
        echo 📡 SSE端点: http://localhost:%MCP_HTTP_PORT%/sse
    )
)
echo.

REM 启动应用 (后台运行)
set NODE_ENV=production
set FORCE_INTERACTIVE=true

REM 使用start /B后台启动，重定向输出到日志文件
start /B node dist/cli.js start --debug > "%LOG_FILE%" 2>&1

REM 获取进程PID (Windows方式)
timeout /t 1 /nobreak >nul
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| find "node.exe" ^| find /V "PID"') do (
    set APP_PID=%%i
    set APP_PID=!APP_PID:"=!
    goto :found_pid
)

:found_pid
if "%APP_PID%"=="" (
    call :log_error "无法获取进程PID"
    exit /b 1
)

REM 保存PID到文件
echo %APP_PID% > "%PID_FILE%"

REM 等待一下确保启动成功
timeout /t 2 /nobreak >nul

REM 检查进程是否还在运行
tasklist /FI "PID eq %APP_PID%" 2>nul | find "%APP_PID%" >nul
if not errorlevel 1 (
    call :log_success "服务器启动成功！"
    if "%COLORS_ENABLED%"=="1" (
        echo %GREEN%✅ 进程ID: %APP_PID%%NC%
        echo %GREEN%✅ 日志文件: %LOG_FILE%%NC%
        echo %GREEN%✅ PID文件: %PID_FILE%%NC%
        echo.
        echo %CYAN%📋 管理命令:%NC%
        echo %CYAN%   start.bat stop     - 停止服务器%NC%
        echo %CYAN%   start.bat status   - 查看状态%NC%
        echo %CYAN%   start.bat restart  - 重启服务器%NC%
        echo %CYAN%   type %LOG_FILE% - 查看日志%NC%
    ) else (
        echo ✅ 进程ID: %APP_PID%
        echo ✅ 日志文件: %LOG_FILE%
        echo ✅ PID文件: %PID_FILE%
        echo.
        echo 📋 管理命令:
        echo    start.bat stop     - 停止服务器
        echo    start.bat status   - 查看状态
        echo    start.bat restart  - 重启服务器
        echo    type %LOG_FILE% - 查看日志
    )
) else (
    call :log_error "服务器启动失败！"
    del "%PID_FILE%" 2>nul
    if "%COLORS_ENABLED%"=="1" (
        echo %RED%请查看日志文件: %LOG_FILE%%NC%
    ) else (
        echo 请查看日志文件: %LOG_FILE%
    )
    exit /b 1
)
goto :eof

REM 停止服务器
:stop_application
call :log_step "停止 MCP Feedback Collector..."

set PID_FILE=logs\mcp-feedback-collector.pid

if not exist "%PID_FILE%" (
    call :log_error "PID文件不存在，服务器可能未运行"
    exit /b 1
)

set /p APP_PID=<"%PID_FILE%"

tasklist /FI "PID eq %APP_PID%" 2>nul | find "%APP_PID%" >nul
if errorlevel 1 (
    call :log_warning "进程 %APP_PID% 不存在，清理PID文件"
    del "%PID_FILE%" 2>nul
    exit /b 1
)

call :log_info "正在停止进程 %APP_PID%..."

REM 终止进程
taskkill /PID %APP_PID% /F >nul 2>&1

REM 等待进程结束
timeout /t 2 /nobreak >nul

REM 清理PID文件
del "%PID_FILE%" 2>nul

REM 检查进程是否已停止
tasklist /FI "PID eq %APP_PID%" 2>nul | find "%APP_PID%" >nul
if errorlevel 1 (
    call :log_success "服务器已停止"
) else (
    call :log_error "无法停止服务器"
    exit /b 1
)
goto :eof

REM 查看服务器状态
:status_application
call :log_step "检查 MCP Feedback Collector 状态..."

set PID_FILE=logs\mcp-feedback-collector.pid
set LOG_FILE=logs\mcp-feedback-collector.log

if not exist "%PID_FILE%" (
    if "%COLORS_ENABLED%"=="1" (
        echo %RED%❌ 服务器未运行 ^(PID文件不存在^)%NC%
    ) else (
        echo ❌ 服务器未运行 ^(PID文件不存在^)
    )
    exit /b 1
)

set /p APP_PID=<"%PID_FILE%"

tasklist /FI "PID eq %APP_PID%" 2>nul | find "%APP_PID%" >nul
if not errorlevel 1 (
    if "%COLORS_ENABLED%"=="1" (
        echo %GREEN%✅ 服务器正在运行%NC%
        echo %CYAN%📋 进程ID: %APP_PID%%NC%
        echo %CYAN%📋 PID文件: %PID_FILE%%NC%
        echo %CYAN%📋 日志文件: %LOG_FILE%%NC%
        echo.
        echo %CYAN%📋 进程信息:%NC%
    ) else (
        echo ✅ 服务器正在运行
        echo 📋 进程ID: %APP_PID%
        echo 📋 PID文件: %PID_FILE%
        echo 📋 日志文件: %LOG_FILE%
        echo.
        echo 📋 进程信息:
    )
    
    REM 显示进程信息
    tasklist /FI "PID eq %APP_PID%" /FO TABLE 2>nul
    
    REM 显示最近的日志
    if exist "%LOG_FILE%" (
        if "%COLORS_ENABLED%"=="1" (
            echo %CYAN%📋 最近日志 ^(最后10行^):%NC%
        ) else (
            echo 📋 最近日志 ^(最后10行^):
        )
        powershell -Command "Get-Content '%LOG_FILE%' -Tail 10" 2>nul
    )
) else (
    if "%COLORS_ENABLED%"=="1" (
        echo %RED%❌ 服务器未运行 ^(进程 %APP_PID% 不存在^)%NC%
    ) else (
        echo ❌ 服务器未运行 ^(进程 %APP_PID% 不存在^)
    )
    call :log_warning "清理过期的PID文件"
    del "%PID_FILE%" 2>nul
    exit /b 1
)
goto :eof

REM 重启服务器
:restart_application
call :log_step "重启 MCP Feedback Collector..."

REM 先停止服务器
if exist "logs\mcp-feedback-collector.pid" (
    call :stop_application
    timeout /t 2 /nobreak >nul
)

REM 重新启动
call :start_application
goto :eof

REM 显示帮助信息
:show_help
echo 用法: %0 [命令] [选项]
echo.
echo 命令:
echo   start                     启动服务器 ^(默认^)
echo   stop                      停止服务器
echo   status                    查看服务器状态
echo   restart                   重启服务器
echo.
echo 选项 ^(仅适用于start命令^):
echo   --transport=MODE          设置传输模式 ^(streamable_http^|sse^|stdio^)
echo   --web-port=PORT           设置Web端口
echo   --mcp-port=PORT           设置MCP端口
echo   --log-level=LEVEL         设置日志级别 ^(error^|warn^|info^|debug^)
echo   --help, -h                显示此帮助信息
echo.
echo 环境变量:
echo   MCP_WEB_PORT              Web服务器端口 ^(默认: 5000^)
echo   MCP_HTTP_PORT             MCP HTTP端口 ^(默认: 3001^)
echo   MCP_TOOLBAR_PORT          Toolbar端口 ^(固定: 5749^)
echo   MCP_TRANSPORT_MODE        传输模式 ^(默认: streamable_http^)
echo   LOG_LEVEL                 日志级别 ^(默认: info^)
echo.
echo 示例:
echo   %0                        启动服务器
echo   %0 start --web-port=8080  使用指定端口启动
echo   %0 stop                   停止服务器
echo   %0 status                 查看状态
echo   %0 restart                重启服务器
goto :eof

REM 主函数
:main
REM 检查第一个参数是否为命令
set COMMAND=
if not "%1"=="" (
    if "%1"=="start" set COMMAND=start
    if "%1"=="stop" set COMMAND=stop
    if "%1"=="status" set COMMAND=status
    if "%1"=="restart" set COMMAND=restart
)

REM 如果没有指定命令，默认为start
if "%COMMAND%"=="" set COMMAND=start

REM 处理命令
if "%COMMAND%"=="stop" (
    call :show_banner
    call :stop_application
    exit /b 0
)
if "%COMMAND%"=="status" (
    call :show_banner
    call :status_application
    exit /b 0
)
if "%COMMAND%"=="restart" (
    call :show_banner
    call :restart_application
    exit /b 0
)
if "%COMMAND%"=="start" (
    REM 继续处理start命令的参数
    if not "%1"=="" shift
)

call :show_banner

REM 解析命令行参数
:parse_args
if "%1"=="" goto :start_execution

if "%1"=="--help" goto :show_help_and_exit
if "%1"=="-h" goto :show_help_and_exit

REM 处理带等号的参数
echo %1 | findstr "^--transport=" >nul
if not errorlevel 1 (
    for /f "tokens=2 delims==" %%a in ("%1") do set MCP_TRANSPORT_MODE=%%a
    shift
    goto :parse_args
)

echo %1 | findstr "^--web-port=" >nul
if not errorlevel 1 (
    for /f "tokens=2 delims==" %%a in ("%1") do set MCP_WEB_PORT=%%a
    shift
    goto :parse_args
)

echo %1 | findstr "^--mcp-port=" >nul
if not errorlevel 1 (
    for /f "tokens=2 delims==" %%a in ("%1") do set MCP_HTTP_PORT=%%a
    shift
    goto :parse_args
)

echo %1 | findstr "^--log-level=" >nul
if not errorlevel 1 (
    for /f "tokens=2 delims==" %%a in ("%1") do set LOG_LEVEL=%%a
    shift
    goto :parse_args
)

call :log_error "未知选项: %1"
echo 使用 --help 查看帮助信息
exit /b 1

:show_help_and_exit
call :show_help
exit /b 0

:start_execution
REM 执行启动流程
call :check_environment
if errorlevel 1 exit /b 1

call :configure_ports
if errorlevel 1 exit /b 1

call :configure_transport
if errorlevel 1 exit /b 1

call :show_configuration

echo.

call :start_application
goto :eof

REM 程序入口
call :main %* 