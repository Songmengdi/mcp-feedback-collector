/**
 * Modern Prompt Monitor - 主要JavaScript逻辑
 * 支持可折叠控制面板和现代交互
 */

class PromptMonitor {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.messages = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        this.reconnectTimer = null;
        this.isPanelCollapsed = false;
        
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
        // 顶部导航元素
        this.connectionBadge = document.getElementById('connection-badge');
        this.connectionText = document.getElementById('connection-text');
        
        // 控制按钮
        this.connectBtn = document.getElementById('connect-btn');
        this.disconnectBtn = document.getElementById('disconnect-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.expandToggle = document.getElementById('expand-toggle');
        this.collapseBtn = document.getElementById('collapse-btn');
        
        // 消息区域
        this.messageCount = document.getElementById('message-count');
        this.messagesList = document.getElementById('messages-list');
        
        // 状态信息
        this.portInfo = document.getElementById('port-info');
        this.clientCount = document.getElementById('client-count');
        this.uptime = document.getElementById('uptime');
        this.latestTime = document.getElementById('latest-time');
        
        // 控制面板
        this.controlPanel = document.getElementById('control-panel');
        this.connectionToast = document.getElementById('connection-toast');
        this.toastMessage = document.getElementById('toast-message');
    }
    
    attachEventListeners() {
        // 连接控制
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        // 消息控制
        this.clearBtn.addEventListener('click', () => this.clearMessages());
        this.exportBtn.addEventListener('click', () => this.exportData());
        
        // 面板控制
        this.collapseBtn.addEventListener('click', () => this.toggleControlPanel());
        this.settingsToggle.addEventListener('click', () => this.toggleSettings());
        this.expandToggle.addEventListener('click', () => this.toggleExpand());
        
        // 点击面板头部也可以折叠
        document.querySelector('.panel-header').addEventListener('click', (e) => {
            if (e.target === e.currentTarget || e.target.classList.contains('panel-header')) {
                this.toggleControlPanel();
            }
        });
    }
    
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[Monitor] Already connected');
            return;
        }
        
        this.showToast('正在连接服务...');
        this.updateConnectionStatus('connecting', '连接中');
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
                this.showToast('连接成功！', 'success');
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
                this.showToast('连接已断开', 'error');
            };
            
            this.ws.onerror = (error) => {
                console.error('[Monitor] WebSocket error:', error);
                this.updateConnectionStatus('error', '连接错误');
                this.showToast('连接错误', 'error');
            };
            
        } catch (error) {
            console.error('[Monitor] Failed to create WebSocket:', error);
            this.updateConnectionStatus('error', '连接失败');
            this.showToast('连接失败', 'error');
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
        this.showToast('已断开连接', 'info');
        console.log('[Monitor] Manually disconnected');
    }
    
    handleMessage(message) {
        console.log('[Monitor] Received message:', message);

        if (message.event === 'prompt_received' && message.data) {
            const promptData = message.data;
            const originalPrompt = promptData.prompt || '';

            // 自动格式化XML prompt
            const formattedPrompt = this.formatXMLPrompt(originalPrompt);

            const messageItem = {
                id: Date.now() + Math.random(),
                timestamp: new Date(),
                sessionId: promptData.sessionId || 'Unknown',
                prompt: formattedPrompt,
                originalPrompt: originalPrompt,
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
        this.connectionBadge.className = `connection-badge ${status}`;
        this.connectionText.textContent = text;
    }
    
    updateUI() {
        this.connectBtn.disabled = this.isConnected;
        this.disconnectBtn.disabled = !this.isConnected;
    }
    
    toggleControlPanel() {
        this.isPanelCollapsed = !this.isPanelCollapsed;
        this.controlPanel.classList.toggle('collapsed', this.isPanelCollapsed);
        
        // 保存状态到本地存储
        localStorage.setItem('panelCollapsed', this.isPanelCollapsed);
    }
    
    toggleSettings() {
        // 可以扩展为打开设置模态框
        console.log('[Monitor] Settings toggled');
    }
    
    toggleExpand() {
        // 切换全屏模式
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    showToast(message, type = 'info') {
        this.toastMessage.textContent = message;
        this.connectionToast.className = `connection-toast show ${type}`;
        
        setTimeout(() => {
            this.connectionToast.classList.remove('show');
        }, 3000);
    }
    
    updateMessagesDisplay() {
        this.messageCount.textContent = this.messages.length;
        
        if (this.messages.length === 0) {
            this.messagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>暂无Prompt消息</p>
                    <small>等待连接或新的Prompt输入...</small>
                </div>
            `;
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
        
    }
    
    createMessageHTML(message) {
        const timeStr = message.timestamp.toLocaleString('zh-CN');
        // 基于原始prompt长度判断是否需要展开按钮
        const isLong = message.originalPrompt && message.originalPrompt.length > 200;

        // 对于格式化后的内容，按行截取预览
        const lines = message.prompt.split('\n');
        const promptPreview = isLong && lines.length > 10 ? lines.slice(0,10).join('\n') + '\n...' : message.prompt;

        return `
            <div class="message-item fade-in" data-message-id="${message.id}">
                <div class="message-header">
                    <span class="message-session">
                        <i class="fas fa-user-circle"></i>
                        ${message.sessionId}
                    </span>
                    <div class="message-actions">
                        <button class="btn-copy" title="复制Prompt">
                            <i class="fas fa-copy"></i>
                        </button>
                        <span class="message-time">${timeStr}</span>
                    </div>
                </div>
                <div class="message-content" data-full="${this.escapeHtml(message.prompt)}" data-preview="${this.escapeHtml(promptPreview)}">${this.escapeHtml(promptPreview)}</div>
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
            this.showToast('消息已清除', 'info');
            console.log('[Monitor] Messages cleared');
        }
    }
    
    exportData() {
        if (this.messages.length === 0) {
            this.showToast('没有数据可以导出', 'warning');
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
        a.download = `prompt-monitor-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('数据已导出', 'success');
        console.log('[Monitor] Data exported');
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`[Monitor] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
            this.updateConnectionStatus('error', '重连失败');
            this.showToast('重连失败，请检查服务', 'error');
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
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.style.color = 'var(--success-color)';
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.color = '';
            }, 2000);
            
            console.log('[Monitor] Prompt copied to clipboard');
        } catch (error) {
            console.error('[Monitor] Copy failed:', error);
            button.innerHTML = '<i class="fas fa-times"></i>';
            button.style.color = 'var(--danger-color)';
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy"></i>';
                button.style.color = '';
            }, 2000);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 格式化XML格式的prompt为友好的中文格式
     */
    formatXMLPrompt(xmlString) {
        try {
            console.log(xmlString);
            // 尝试解析XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

            // 检查解析是否成功
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                console.warn('[Monitor] XML解析失败，使用原始内容:', parseError.textContent);
                return xmlString;
            }

            // 检查是否有request根标签
            const requestElement = xmlDoc.querySelector('request');
            if (!requestElement) {
                console.warn('[Monitor] 未找到request根标签，使用原始内容');
                return xmlString;
            }
            

            // 提取XML中的字段，使用正确的选择器路径
            const userGoal = xmlDoc.querySelector('request > user_goal')?.textContent?.trim() || '';
            const url = xmlDoc.querySelector('request > url')?.textContent?.trim() || '';

            // 检查是否有selected_elements（有HTML时）或context（无HTML时）
            const selectedElements = xmlDoc.querySelector('request > selected_elements')?.innerHTML?.trim() || '';
            const context = xmlDoc.querySelector('request > context')?.textContent?.trim() || '';

            // 如果没有找到预期的XML结构，返回原始内容
            if (!userGoal && !url && !selectedElements && !context) {
                console.warn('[Monitor] 未找到预期的XML结构，使用原始内容');
                return xmlString;
            }

            // 格式化为友好的中文格式
            let formattedText = '';

            if (userGoal) {
                formattedText += `用户目标: ${userGoal}\n`;
            }

            if (url) {
                formattedText += `页面URL: ${url}\n`;
            }

            // 优先显示selected_elements，如果没有则显示context
            if (selectedElements) {
                formattedText += `选中元素:\n\`\`\`html\n${selectedElements}\n\`\`\``;
            } else if (context) {
                formattedText += `页面html:\n\`\`\`html\n${context}\n\`\`\``;
            }

            return formattedText.trim() || xmlString;

        } catch (error) {
            console.error('[Monitor] XML格式化失败:', error);
            // 降级处理：返回原始prompt
            return xmlString;
        }
    }
    
    loadSettings() {
        // 加载保存的设置
        const panelCollapsed = localStorage.getItem('panelCollapsed') === 'true';
        if (panelCollapsed) {
            this.isPanelCollapsed = true;
            this.controlPanel.classList.add('collapsed');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Monitor] Initializing Prompt Monitor...');
    window.promptMonitor = new PromptMonitor();
    window.promptMonitor.loadSettings();
});
