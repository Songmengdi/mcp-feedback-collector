/**
 * Toolbar Monitor - 主要JavaScript逻辑
 */

class ToolbarMonitor {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.messages = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        this.reconnectTimer = null;
        
        // WebSocket URL
        this.wsUrl = 'ws://localhost:15749/broadcast';
        this.statusApiUrl = 'http://localhost:15749/api/broadcast/status';
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateUI();
        
        // 自动连接
        this.connect();
        
        // 定期更新状态
        this.startStatusUpdater();
    }
    
    initializeElements() {
        // 状态元素
        this.connectionStatus = document.getElementById('connection-status');
        this.connectionText = document.getElementById('connection-text');
        this.portInfo = document.getElementById('port-info');
        this.clientCount = document.getElementById('client-count');
        this.uptime = document.getElementById('uptime');
        this.latestTime = document.getElementById('latest-time');
        this.messageCount = document.getElementById('message-count');
        
        // 按钮元素
        this.connectBtn = document.getElementById('connect-btn');
        this.disconnectBtn = document.getElementById('disconnect-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.exportBtn = document.getElementById('export-btn');
        
        // 消息列表
        this.messagesList = document.getElementById('messages-list');
    }
    
    attachEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.clearBtn.addEventListener('click', () => this.clearMessages());
        this.exportBtn.addEventListener('click', () => this.exportData());
    }
    
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[Monitor] Already connected');
            return;
        }
        
        this.updateConnectionStatus('connecting', '连接中...');
        console.log(`[Monitor] Connecting to ${this.wsUrl}`);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('[Monitor] WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.clearReconnectTimer();
                this.updateConnectionStatus('connected', '已连接');
                this.updateUI();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[Monitor] Failed to parse message:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log(`[Monitor] WebSocket closed: code=${event.code}, reason=${event.reason}`);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', '连接断开');
                this.updateUI();
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('[Monitor] WebSocket error:', error);
                this.updateConnectionStatus('error', '连接错误');
            };
            
        } catch (error) {
            console.error('[Monitor] Failed to create WebSocket:', error);
            this.updateConnectionStatus('error', '连接失败');
            this.scheduleReconnect();
        }
    }
    
    disconnect() {
        this.clearReconnectTimer();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', '已断开');
        this.updateUI();
        console.log('[Monitor] Manually disconnected');
    }
    
    handleMessage(message) {
        console.log('[Monitor] Received message:', message);
        
        if (message.event === 'prompt_received' && message.data) {
            const promptData = message.data;
            const messageItem = {
                id: Date.now() + Math.random(),
                timestamp: new Date(),
                sessionId: promptData.sessionId || 'Unknown',
                prompt: promptData.prompt || '',
                model: promptData.model || 'Unknown',
                files: promptData.files || [],
                images: promptData.images || [],
                mode: promptData.mode || 'Unknown',
                metadata: promptData.metadata || {}
            };
            
            this.messages.unshift(messageItem);
            this.updateMessagesDisplay();
            this.updateLatestTime();
            
            console.log(`[Monitor] Added new message from session: ${messageItem.sessionId}`);
        }
    }
    
    updateConnectionStatus(status, text) {
        this.connectionStatus.className = `status-indicator ${status}`;
        this.connectionText.textContent = text;
    }
    
    updateUI() {
        this.connectBtn.disabled = this.isConnected;
        this.disconnectBtn.disabled = !this.isConnected;
    }
    
    updateMessagesDisplay() {
        this.messageCount.textContent = this.messages.length;
        
        if (this.messages.length === 0) {
            this.messagesList.innerHTML = '<div class="no-messages">暂无消息</div>';
            return;
        }
        
        const messagesHtml = this.messages.map(msg => this.createMessageHTML(msg)).join('');
        this.messagesList.innerHTML = messagesHtml;
        
        // 添加复制和展开按钮的事件监听器
        this.attachMessageEventListeners();
    }
    
    attachMessageEventListeners() {
        // 复制按钮事件
        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const messageId = e.target.closest('.message-item').dataset.messageId;
                const message = this.messages.find(m => m.id == messageId);
                if (message) {
                    this.copyToClipboard(message.prompt, e.target);
                }
            });
        });
        
        // 展开按钮事件
        document.querySelectorAll('.btn-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleMessageExpansion(e.target);
            });
        });
    }
    
    createMessageHTML(message) {
        const timeStr = message.timestamp.toLocaleString('zh-CN');
        const isLong = message.prompt.length > 200;
        const promptPreview = isLong ? message.prompt.substring(0, 200) + '...' : message.prompt;
        const expandId = `expand-${message.id}`;
        const copyId = `copy-${message.id}`;
        
        return `
            <div class="message-item" data-message-id="${message.id}">
                <div class="message-header">
                    <span class="message-session">会话: ${message.sessionId}</span>
                    <div class="message-actions">
                        <button class="btn-copy" id="${copyId}" title="复制Prompt">📋 复制</button>
                        ${isLong ? `<button class="btn-expand" id="${expandId}" title="展开完整内容">📖 展开</button>` : ''}
                        <span class="message-time">${timeStr}</span>
                    </div>
                </div>
                <div class="message-content" data-full="${this.escapeHtml(message.prompt)}" data-preview="${this.escapeHtml(promptPreview)}">
                    ${this.escapeHtml(promptPreview)}
                </div>
                <div class="message-meta">
                    <span>模型: ${message.model}</span>
                    <span>模式: ${message.mode}</span>
                    <span>文件: ${message.files.length}</span>
                    <span>图片: ${message.images.length}</span>
                </div>
            </div>
        `;
    }
    
    updateLatestTime() {
        if (this.messages.length > 0) {
            const latest = this.messages[0].timestamp;
            this.latestTime.textContent = latest.toLocaleTimeString('zh-CN');
        }
    }
    
    clearMessages() {
        if (confirm('确定要清除所有消息历史吗？')) {
            this.messages = [];
            this.updateMessagesDisplay();
            this.latestTime.textContent = '-';
            console.log('[Monitor] Messages cleared');
        }
    }
    
    exportData() {
        if (this.messages.length === 0) {
            alert('没有数据可以导出');
            return;
        }
        
        const data = {
            exportTime: new Date().toISOString(),
            messageCount: this.messages.length,
            messages: this.messages
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toolbar-messages-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[Monitor] Data exported');
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`[Monitor] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
            this.updateConnectionStatus('error', '重连失败');
            return;
        }
        
        this.clearReconnectTimer();
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`[Monitor] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        this.updateConnectionStatus('connecting', `重连中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }
    
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    
    async updateServerStatus() {
        try {
            const response = await fetch(this.statusApiUrl);
            if (response.ok) {
                const status = await response.json();
                this.clientCount.textContent = status.clients || '-';
                this.uptime.textContent = this.formatUptime(status.uptime || 0);
            }
        } catch (error) {
            // 静默失败，不影响主要功能
        }
    }
    
    startStatusUpdater() {
        // 每30秒更新一次状态
        setInterval(() => {
            if (this.isConnected) {
                this.updateServerStatus();
            }
        }, 30000);
        
        // 立即更新一次
        this.updateServerStatus();
    }
    
    formatUptime(seconds) {
        if (seconds < 60) return `${Math.floor(seconds)}秒`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
        return `${Math.floor(seconds / 86400)}天`;
    }
    
    async copyToClipboard(text, button) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            
            // 显示复制成功反馈
            const originalText = button.textContent;
            button.textContent = '✅ 已复制';
            button.style.background = '#28a745';
            button.style.color = 'white';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
                button.style.color = '';
            }, 2000);
            
            console.log('[Monitor] Prompt copied to clipboard');
        } catch (error) {
            console.error('[Monitor] Copy failed:', error);
            button.textContent = '❌ 复制失败';
            setTimeout(() => {
                button.textContent = '📋 复制';
            }, 2000);
        }
    }
    
    toggleMessageExpansion(button) {
        const messageItem = button.closest('.message-item');
        const contentDiv = messageItem.querySelector('.message-content');
        const isExpanded = button.textContent.includes('收起');
        
        if (isExpanded) {
            // 收起
            contentDiv.textContent = contentDiv.dataset.preview;
            button.textContent = '📖 展开';
        } else {
            // 展开
            contentDiv.textContent = contentDiv.dataset.full;
            button.textContent = '📖 收起';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Monitor] Initializing Toolbar Monitor...');
    window.toolbarMonitor = new ToolbarMonitor();
}); 