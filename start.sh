#!/bin/bash

# MCP Feedback Collector 智能启动器
# 功能：环境检查、端口检测、自动配置、应用启动

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
DEFAULT_WEB_PORT=5000
DEFAULT_MCP_PORT=3001
FIXED_TOOLBAR_PORT=5749  # Toolbar端口固定不可更改
MAX_PORT_ATTEMPTS=10
PORT_RANGE_START=3001
PORT_RANGE_END=3100

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# 显示启动横幅
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                MCP Feedback Collector                        ║"
    echo "║                    智能启动器 v2.0                           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "命令 '$1' 未找到，请先安装"
        return 1
    fi
    return 0
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # 端口被占用
    else
        return 0  # 端口可用
    fi
}

# 查找可用端口
find_available_port() {
    local start_port=$1
    local max_attempts=${2:-$MAX_PORT_ATTEMPTS}
    
    for ((i=0; i<max_attempts; i++)); do
        local port=$((start_port + i))
        if [ $port -gt $PORT_RANGE_END ]; then
            break
        fi
        
        if check_port $port; then
            echo $port
            return 0
        fi
    done
    
    return 1  # 未找到可用端口
}

# 显示端口占用信息
show_port_usage() {
    local port=$1
    log_warning "端口 $port 被占用，占用进程："
    lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | head -5 || echo "  无法获取进程信息"
}

# 杀死占用端口的进程
kill_port_process() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null)
    
    if [ -n "$pids" ]; then
        log_warning "正在终止占用端口 $port 的进程: $pids"
        echo $pids | xargs kill -9 2>/dev/null || true
        sleep 2
        
        # 再次检查
        if check_port $port; then
            log_success "端口 $port 已释放"
            return 0
        else
            log_error "无法释放端口 $port"
            return 1
        fi
    else
        log_info "端口 $port 未被占用"
        return 0
    fi
}

# 环境检查
check_environment() {
    log_step "检查运行环境..."
    
    # 检查Node.js
    if ! check_command "node"; then
        log_error "请先安装 Node.js (建议版本 >= 18)"
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    log_info "Node.js 版本: $node_version"
    
    # 检查npm
    if ! check_command "npm"; then
        log_error "请先安装 npm"
        exit 1
    fi
    
    # 检查项目文件
    if [ ! -f "package.json" ]; then
        log_error "未找到 package.json，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        log_warning "未找到 node_modules，正在安装依赖..."
        npm install
    fi
    
    # 检查构建文件
    if [ ! -d "dist" ]; then
        log_warning "未找到构建文件，正在构建项目..."
        npm run build
    fi
    
    log_success "环境检查完成"
}

# 端口配置
configure_ports() {
    log_step "配置端口..."
    
    # Web端口配置
    local web_port=${MCP_WEB_PORT:-$DEFAULT_WEB_PORT}
    if ! check_port $web_port; then
        show_port_usage $web_port
        log_info "正在释放Web端口 $web_port..."
        kill_port_process $web_port
        if [ $? -ne 0 ]; then
            web_port=$(find_available_port $((web_port + 1)))
            if [ $? -ne 0 ]; then
                log_error "无法找到可用的Web端口"
                exit 1
            fi
            log_info "使用替代Web端口: $web_port"
        fi
    fi
    export MCP_WEB_PORT=$web_port
    
    # MCP HTTP端口配置
    local mcp_port=${MCP_HTTP_PORT:-$DEFAULT_MCP_PORT}
    if ! check_port $mcp_port; then
        show_port_usage $mcp_port
        log_info "正在释放MCP端口 $mcp_port..."
        kill_port_process $mcp_port
        if [ $? -ne 0 ]; then
            mcp_port=$(find_available_port $((mcp_port + 1)))
            if [ $? -ne 0 ]; then
                log_error "无法找到可用的MCP端口"
                exit 1
            fi
            log_info "使用替代MCP端口: $mcp_port"
        fi
    fi
    export MCP_HTTP_PORT=$mcp_port
    
    # Toolbar端口配置（固定端口5749）
    local toolbar_port=$FIXED_TOOLBAR_PORT
    if ! check_port $toolbar_port; then
        show_port_usage $toolbar_port
        log_info "正在释放Toolbar端口 $toolbar_port..."
        kill_port_process $toolbar_port
        if [ $? -ne 0 ]; then
            log_error "无法释放Toolbar端口 $toolbar_port，该端口为固定端口"
            log_error "请手动释放端口 $toolbar_port 后重试"
            exit 1
        fi
    fi
    export MCP_TOOLBAR_PORT=$toolbar_port
    
    log_success "端口配置完成"
    log_info "Web端口: $MCP_WEB_PORT"
    log_info "MCP端口: $MCP_HTTP_PORT"
    log_info "Toolbar端口: $MCP_TOOLBAR_PORT (固定)"
}

# 设置传输模式
configure_transport() {
    log_step "配置传输模式..."
    
    local transport_mode=${MCP_TRANSPORT_MODE:-"streamable_http"}
    export MCP_TRANSPORT_MODE=$transport_mode
    
    case $transport_mode in
        "streamable_http")
            log_info "使用 StreamableHTTP 传输模式"
            export MCP_ENABLE_SSE_FALLBACK=${MCP_ENABLE_SSE_FALLBACK:-"true"}
            ;;
        "sse")
            log_info "使用 SSE 传输模式"
            ;;
        "stdio")
            log_info "使用 stdio 传输模式"
            ;;
        *)
            log_warning "未知传输模式 '$transport_mode'，使用默认模式 'streamable_http'"
            export MCP_TRANSPORT_MODE="streamable_http"
            ;;
    esac
    
    log_success "传输模式配置完成"
}

# 显示配置信息
show_configuration() {
    log_step "当前配置信息："
    echo -e "${CYAN}┌─────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC}  配置项                值              ${CYAN}│${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC}  Web端口               $MCP_WEB_PORT              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  MCP端口               $MCP_HTTP_PORT              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  Toolbar端口           $MCP_TOOLBAR_PORT (固定)        ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  传输模式               $MCP_TRANSPORT_MODE    ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  SSE回退               ${MCP_ENABLE_SSE_FALLBACK:-false}             ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  日志级别               ${LOG_LEVEL:-info}             ${CYAN}│${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────┘${NC}"
}

# 启动应用
start_application() {
    log_step "启动 MCP Feedback Collector..."
    
    # 设置其他环境变量
    export MCP_CORS_ORIGIN=${MCP_CORS_ORIGIN:-"*"}
    export MCP_CLEANUP_PORT_ON_START=${MCP_CLEANUP_PORT_ON_START:-"true"}
    export MCP_USE_FIXED_URL=${MCP_USE_FIXED_URL:-"true"}
    
    # 创建日志目录
    mkdir -p logs
    
    # 设置日志文件
    local log_file="logs/mcp-feedback-collector.log"
    local pid_file="logs/mcp-feedback-collector.pid"
    
    # 检查是否已经在运行
    if [ -f "$pid_file" ]; then
        local existing_pid=$(cat "$pid_file")
        if kill -0 "$existing_pid" 2>/dev/null; then
            log_error "服务器已在运行中 (PID: $existing_pid)"
            log_info "使用 './start.sh stop' 停止服务器"
            exit 1
        else
            log_warning "发现过期的PID文件，正在清理..."
            rm -f "$pid_file"
        fi
    fi
    
    # 显示启动信息
    echo -e "${GREEN}🚀 正在启动服务器...${NC}"
    echo -e "${BLUE}📡 Web界面: http://localhost:$MCP_WEB_PORT${NC}"
    echo -e "${BLUE}🔗 MCP API: http://localhost:$MCP_HTTP_PORT/mcp${NC}"
    
    if [ "$MCP_ENABLE_SSE_FALLBACK" = "true" ]; then
        echo -e "${BLUE}📡 SSE端点: http://localhost:$MCP_HTTP_PORT/sse${NC}"
    fi
    
    echo ""
    
    # 启动应用 (后台运行)
    export NODE_ENV=production
    export FORCE_INTERACTIVE=true
    
    # 使用nohup后台启动，重定向输出到日志文件
    nohup node dist/cli.js start --debug > "$log_file" 2>&1 &
    local app_pid=$!
    
    # 保存PID到文件
    echo "$app_pid" > "$pid_file"
    
    # 等待一下确保启动成功
    sleep 2
    
    # 检查进程是否还在运行
    if kill -0 "$app_pid" 2>/dev/null; then
        log_success "服务器启动成功！"
        echo -e "${GREEN}✅ 进程ID: $app_pid${NC}"
        echo -e "${GREEN}✅ 日志文件: $log_file${NC}"
        echo -e "${GREEN}✅ PID文件: $pid_file${NC}"
        echo ""
        echo -e "${CYAN}📋 管理命令:${NC}"
        echo -e "${CYAN}   ./start.sh stop     - 停止服务器${NC}"
        echo -e "${CYAN}   ./start.sh status   - 查看状态${NC}"
        echo -e "${CYAN}   ./start.sh restart  - 重启服务器${NC}"
        echo -e "${CYAN}   tail -f $log_file - 查看日志${NC}"
    else
        log_error "服务器启动失败！"
        rm -f "$pid_file"
        echo -e "${RED}请查看日志文件: $log_file${NC}"
        exit 1
    fi
}

# 停止服务器
stop_application() {
    log_step "停止 MCP Feedback Collector..."
    
    local pid_file="logs/mcp-feedback-collector.pid"
    
    if [ ! -f "$pid_file" ]; then
        log_error "PID文件不存在，服务器可能未运行"
        exit 1
    fi
    
    local app_pid=$(cat "$pid_file")
    
    if ! kill -0 "$app_pid" 2>/dev/null; then
        log_warning "进程 $app_pid 不存在，清理PID文件"
        rm -f "$pid_file"
        exit 1
    fi
    
    log_info "正在停止进程 $app_pid..."
    
    # 发送TERM信号
    kill -TERM "$app_pid" 2>/dev/null
    
    # 等待进程结束
    local count=0
    while kill -0 "$app_pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo ""
    
    # 如果进程仍在运行，强制终止
    if kill -0 "$app_pid" 2>/dev/null; then
        log_warning "进程未响应，强制终止..."
        kill -KILL "$app_pid" 2>/dev/null
        sleep 1
    fi
    
    # 清理PID文件
    rm -f "$pid_file"
    
    if ! kill -0 "$app_pid" 2>/dev/null; then
        log_success "服务器已停止"
    else
        log_error "无法停止服务器"
        exit 1
    fi
}

# 查看服务器状态
status_application() {
    log_step "检查 MCP Feedback Collector 状态..."
    
    local pid_file="logs/mcp-feedback-collector.pid"
    local log_file="logs/mcp-feedback-collector.log"
    
    if [ ! -f "$pid_file" ]; then
        echo -e "${RED}❌ 服务器未运行 (PID文件不存在)${NC}"
        exit 1
    fi
    
    local app_pid=$(cat "$pid_file")
    
    if kill -0 "$app_pid" 2>/dev/null; then
        echo -e "${GREEN}✅ 服务器正在运行${NC}"
        echo -e "${CYAN}📋 进程ID: $app_pid${NC}"
        echo -e "${CYAN}📋 PID文件: $pid_file${NC}"
        echo -e "${CYAN}📋 日志文件: $log_file${NC}"
        
        # 显示进程信息
        if command -v ps >/dev/null 2>&1; then
            echo -e "${CYAN}📋 进程信息:${NC}"
            ps -p "$app_pid" -o pid,ppid,cmd,etime 2>/dev/null || echo "无法获取进程信息"
        fi
        
        # 显示最近的日志
        if [ -f "$log_file" ]; then
            echo -e "${CYAN}📋 最近日志 (最后10行):${NC}"
            tail -n 10 "$log_file" 2>/dev/null || echo "无法读取日志文件"
        fi
    else
        echo -e "${RED}❌ 服务器未运行 (进程 $app_pid 不存在)${NC}"
        log_warning "清理过期的PID文件"
        rm -f "$pid_file"
        exit 1
    fi
}

# 重启服务器
restart_application() {
    log_step "重启 MCP Feedback Collector..."
    
    # 先停止服务器
    if [ -f "logs/mcp-feedback-collector.pid" ]; then
        stop_application
        sleep 2
    fi
    
    # 重新启动
    start_application
}

# 清理函数
cleanup() {
    log_info "正在清理资源..."
    
    # 这里可以添加清理逻辑
    # 比如清理临时文件、关闭端口等
    
    log_success "清理完成"
    exit 0
}

# 信号处理
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    # 检查第一个参数是否为命令
    local command=""
    if [[ $# -gt 0 ]]; then
        case $1 in
            start|stop|status|restart)
                command=$1
                shift
                ;;
        esac
    fi
    
    # 如果没有指定命令，默认为start
    if [ -z "$command" ]; then
        command="start"
    fi
    
    # 处理命令
    case $command in
        stop)
            show_banner
            stop_application
            exit 0
            ;;
        status)
            show_banner
            status_application
            exit 0
            ;;
        restart)
            show_banner
            restart_application
            exit 0
            ;;
        start)
            # 继续处理start命令的参数
            ;;
        *)
            log_error "未知命令: $command"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
    
    show_banner
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --transport=*)
                export MCP_TRANSPORT_MODE="${1#*=}"
                shift
                ;;
            --web-port=*)
                export MCP_WEB_PORT="${1#*=}"
                shift
                ;;
            --mcp-port=*)
                export MCP_HTTP_PORT="${1#*=}"
                shift
                ;;
            --log-level=*)
                export LOG_LEVEL="${1#*=}"
                shift
                ;;
            --help|-h)
                echo "用法: $0 [命令] [选项]"
                echo ""
                echo "命令:"
                echo "  start                     启动服务器 (默认)"
                echo "  stop                      停止服务器"
                echo "  status                    查看服务器状态"
                echo "  restart                   重启服务器"
                echo ""
                echo "选项 (仅适用于start命令):"
                echo "  --transport=MODE          设置传输模式 (streamable_http|sse|stdio)"
                echo "  --web-port=PORT           设置Web端口"
                echo "  --mcp-port=PORT           设置MCP端口"
                echo "  --log-level=LEVEL         设置日志级别 (error|warn|info|debug)"
                echo "  --help, -h                显示此帮助信息"
                echo ""
                echo "环境变量:"
                echo "  MCP_WEB_PORT              Web服务器端口 (默认: 5000)"
                echo "  MCP_HTTP_PORT             MCP HTTP端口 (默认: 3001)"
                echo "  MCP_TOOLBAR_PORT          Toolbar端口 (固定: 5749)"
                echo "  MCP_TRANSPORT_MODE        传输模式 (默认: streamable_http)"
                echo "  LOG_LEVEL                 日志级别 (默认: info)"
                echo ""
                echo "示例:"
                echo "  $0                        启动服务器"
                echo "  $0 start --web-port=8080  使用指定端口启动"
                echo "  $0 stop                   停止服务器"
                echo "  $0 status                 查看状态"
                echo "  $0 restart                重启服务器"
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done
    
    # 执行启动流程
    check_environment
    configure_ports
    configure_transport
    show_configuration
    
    echo ""
    
    start_application
}

# 运行主函数
main "$@" 