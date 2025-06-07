/**
 * MCP Feedback Collector - 前端应用脚本
 */

// 全局变量
let socket = null;
let currentTab = 'report';
let selectedImages = [];
let isConnected = false;
let currentFeedbackSession = null;

// 自动刷新相关变量
let autoRefreshInterval = null;
let autoRefreshCountdown = 10;  // 改为10秒
let autoRefreshTimer = null;
let lastWorkSummary = null;  // 记录上次的工作汇报内容



// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 获取并显示版本信息
    fetchVersionInfo();

    // 设置平台相关的快捷键提示
    setupShortcutHint();

    initializeSocket();

    // 检查URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const session = urlParams.get('session');

    console.log('URL参数:', { mode, session });

    if (mode === 'feedback' && session) {
        // 传统反馈模式，设置会话ID并获取工作汇报
        currentFeedbackSession = session;
        console.log('传统模式 - 设置反馈会话ID:', session);

        // 等待WebSocket连接建立后获取工作汇报
        setTimeout(() => {
            if (isConnected && socket) {
                console.log('请求工作汇报数据...');
                socket.emit('get_work_summary', { feedback_session_id: session });
            } else {
                console.log('WebSocket未连接，稍后重试...');
                setTimeout(() => {
                    if (isConnected && socket) {
                        socket.emit('get_work_summary', { feedback_session_id: session });
                    }
                }, 1000);
            }
        }, 500);

        // 显示反馈标签页
        showTab('feedback');
    } else {
        // 固定URL模式或默认模式
        console.log('固定URL模式 - 等待会话分配');

        // 等待WebSocket连接建立后请求会话分配
        setTimeout(() => {
            if (isConnected && socket) {
                console.log('请求会话分配...');
                socket.emit('request_session');
            } else {
                console.log('WebSocket未连接，稍后重试...');
                setTimeout(() => {
                    if (isConnected && socket) {
                        socket.emit('request_session');
                    }
                }, 1000);
            }
        }, 500);

        // 默认显示工作汇报标签页（因为HTML中默认是active的）
        showTab('feedback');
    }

    // 默认启动自动刷新
    setTimeout(() => {
        startAutoRefresh();
    }, 1000); // 延迟1秒启动，确保页面完全加载
});

// 初始化WebSocket连接
function initializeSocket() {
    console.log('初始化Socket.IO连接...');

    socket = io({
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', function() {
        isConnected = true;
        updateConnectionStatus('connected', '已连接');
        console.log('WebSocket连接成功, ID:', socket.id);
    });

    socket.on('disconnect', function(reason) {
        isConnected = false;
        updateConnectionStatus('disconnected', '连接断开');
        console.log('WebSocket连接断开, 原因:', reason);
    });

    socket.on('connect_error', function(error) {
        isConnected = false;
        updateConnectionStatus('disconnected', '连接失败');
        console.error('WebSocket连接错误:', error);
        showStatusMessage('error', '连接服务器失败，请检查网络或刷新页面重试');
    });

    socket.on('feedback_session_started', function(data) {
        console.log('反馈会话已开始:', data);
    });

    socket.on('feedback_submitted', function(data) {
        clearFeedbackForm();

        // 重新启用提交按钮
        const submitBtn = document.getElementById('submit-feedback-btn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '提交反馈';

        // 清理所有之前的状态消息
        clearAllStatusMessages();

        // 显示成功消息并开始倒计时
        showFeedbackSuccessWithCountdown();

        console.log('反馈提交成功，3秒后自动关闭页面');
    });

    socket.on('feedback_error', function(data) {
        showStatusMessage('error', data.error);
    });

    socket.on('work_summary_data', function(data) {
        console.log('收到工作汇报数据:', data);
        if (data.work_summary) {
            displayWorkSummary(data.work_summary);
            // 记录初始工作汇报内容
            lastWorkSummary = data.work_summary;
            // 切换到反馈标签页
            showTab('feedback');
        }
    });

    // 处理会话分配响应
    socket.on('session_assigned', function(data) {
        console.log('收到会话分配:', data);
        if (data.session_id) {
            currentFeedbackSession = data.session_id;
            console.log('固定URL模式 - 分配的会话ID:', data.session_id);

            // 如果有工作汇报，显示它
            if (data.work_summary) {
                // 检查是否是新内容（如果页面已经有内容）
                const hasExistingContent = lastWorkSummary && lastWorkSummary !== data.work_summary;

                displayWorkSummary(data.work_summary);

                // 如果是新内容且页面已经有内容，自动刷新页面
                if (hasExistingContent) {
                    console.log('检测到新的工作汇报内容，3秒后自动刷新页面以重置会话');
                    showRefreshStatus('success', '✅ 检测到新工作汇报，页面将自动刷新');
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                } else {
                    // 记录初始工作汇报内容
                    lastWorkSummary = data.work_summary;
                    showTab('feedback');
                }
            }
        }
    });

    // 处理无活跃会话的情况
    socket.on('no_active_session', function(data) {
        console.log('无活跃会话:', data);
        // 保持在当前标签页
    });

    // 处理最新工作汇报响应
    socket.on('latest_summary_response', function(data) {
        console.log('收到最新工作汇报响应:', data);

        if (data.success && data.work_summary) {
            // 检查内容是否与上次不同
            if (lastWorkSummary !== data.work_summary) {
                // 显示最新的工作汇报
                displayWorkSummary(data.work_summary);
                // 更新记录的内容
                lastWorkSummary = data.work_summary;
                // 恢复按钮文字
                const refreshText = document.getElementById('refresh-text');
                if (refreshText) {
                    refreshText.textContent = '刷新最新汇报';
                }
                // 使用文字状态显示，而不是弹出提示
                showRefreshStatus('success', '✅ 已获取最新工作汇报，页面将自动刷新');

                // 获取到新内容后自动刷新页面，解决会话过期问题
                console.log('检测到新的工作汇报内容，3秒后自动刷新页面以重置会话');
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                // 内容相同，显示无变化状态
                showRefreshStatus('success', '内容无变化');
                console.log('工作汇报内容未变化，跳过提示');
            }
        } else {
            // 没有找到最新的工作汇报
            showRefreshStatus('error', data.message || '暂无最新工作汇报');
        }
    });
}

// 更新连接状态
function updateConnectionStatus(status, text) {
    const statusEl = document.getElementById('connection-status');
    statusEl.className = `connection-status ${status}`;
    statusEl.textContent = text;
}

// 显示状态消息（弹窗形式）
function showStatusMessage(type, message, autoRemove = true) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastDiv = document.createElement('div');
    toastDiv.className = `toast ${type}`;
    toastDiv.innerHTML = `
        <div class="toast-icon">${getStatusIcon(type)}</div>
        <div class="toast-content">
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close" onclick="removeToast(this.parentElement)">×</button>
    `;

    container.appendChild(toastDiv);

    // 触发显示动画
    setTimeout(() => {
        toastDiv.classList.add('show');
    }, 100);

    // 自动移除消息
    if (autoRemove) {
        setTimeout(() => {
            removeToast(toastDiv);
        }, type === 'error' ? 8000 : 5000);
    }

    function getStatusIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return 'ℹ️';
        }
    }

    return toastDiv;
}

// 移除弹窗消息
function removeToast(toastElement) {
    if (!toastElement || !toastElement.parentElement) return;
    
    toastElement.classList.remove('show');
    setTimeout(() => {
        if (toastElement.parentElement) {
            toastElement.remove();
        }
    }, 300);
}

// 清理所有状态消息
function clearAllStatusMessages() {
    const container = document.getElementById('toast-container');
    if (container) {
        // 为所有弹窗添加移除动画
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => {
            removeToast(toast);
        });
    }
}

// 显示指定标签页
function showTab(tabName) {
    currentTab = tabName;

    // 更新标签状态
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 找到对应的标签按钮并激活
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        if ((tabName === 'feedback' && tab.textContent.includes('工作汇报')) ||
            (tabName === 'chat' && tab.textContent.includes('AI对话'))) {
            tab.classList.add('active');
        }
    });

    // 更新内容区域显示
    document.querySelectorAll('.content-area').forEach(area => {
        area.classList.remove('active');
    });

    // 根据标签名称显示对应内容
    const contentId = tabName === 'feedback' ? 'report-content' : 'chat-content';
    const contentElement = document.getElementById(contentId);
    if (contentElement) {
        contentElement.classList.add('active');
    }
}

// 切换标签（保持向后兼容）
function switchTab(tabName) {
    // 映射标签名称
    const tabMapping = {
        'report': 'feedback',
        'feedback': 'feedback'
    };

    const newTabName = tabMapping[tabName] || tabName;
    showTab(newTabName);
}

// 反馈表单相关功能
function selectImages() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = function(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            try {
                validateImageFile(file);
                addImage(file);
            } catch (error) {
                showStatusMessage('error', `${file.name}: ${error.message}`);
            }
        });
    };

    input.click();
}

function pasteImages() {
    navigator.clipboard.read().then(items => {
        for (const item of items) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    item.getType(type).then(blob => {
                        const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                        addImage(file);
                    });
                }
            }
        }
    }).catch(err => {
        console.log('粘贴失败:', err);
        showStatusMessage('error', '粘贴图片失败，请尝试选择文件方式');
    });
}

function addImage(file) {
    // 显示处理状态
    showStatusMessage('info', `正在处理图片: ${file.name}...`, false);
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // 压缩图片
            const compressedData = await compressImageOnClient(e.target.result, file.name, file.type);
            
            const imageData = {
                file: file,
                data: compressedData.data,
                name: file.name,
                size: compressedData.size,
                type: file.type,
                originalSize: file.size,
                id: Date.now() + Math.random()
            };

            selectedImages.push(imageData);
            updateImagePreviews();
            
            // 显示压缩结果
            const compressionRatio = ((file.size - compressedData.size) / file.size * 100).toFixed(1);
            showStatusMessage('success', `图片已添加 (压缩率: ${compressionRatio}%)`);
        } catch (error) {
            console.error('图片处理失败:', error);
            showStatusMessage('error', `图片处理失败: ${error.message}`);
        }
    };
    reader.readAsDataURL(file);
}

function updateImagePreviews() {
    const container = document.getElementById('image-previews');
    container.innerHTML = '';

    selectedImages.forEach((image, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        
        // 计算压缩信息
        const compressionInfo = image.originalSize ? 
            `<div class="compression-info">
                原始: ${formatFileSize(image.originalSize)} → 压缩后: ${formatFileSize(image.size)}
            </div>` : '';
        
        previewDiv.innerHTML = `
            <img src="${image.data}" alt="${image.name}" class="preview-img" onclick="showImagePreview(${index})">
            <button type="button" class="remove-btn" onclick="removeImage(${index})">×</button>
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                ${compressionInfo}
            </div>
        `;
        container.appendChild(previewDiv);
    });
}

function removeImage(index) {
    selectedImages.splice(index, 1);
    updateImagePreviews();
}

// 前端图片压缩配置
const IMAGE_COMPRESSION_CONFIG = {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.85,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
};

// 前端图片压缩函数
async function compressImageOnClient(base64Data, fileName, fileType) {
    return new Promise((resolve, reject) => {
        try {
            // 验证图片格式
            if (!IMAGE_COMPRESSION_CONFIG.supportedFormats.includes(fileType.toLowerCase())) {
                throw new Error(`不支持的图片格式: ${fileType}`);
            }

            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 计算新尺寸
                    let { width, height } = calculateNewDimensions(
                        img.width, 
                        img.height, 
                        IMAGE_COMPRESSION_CONFIG.maxWidth, 
                        IMAGE_COMPRESSION_CONFIG.maxHeight
                    );

                    canvas.width = width;
                    canvas.height = height;

                    // 绘制图片
                    ctx.drawImage(img, 0, 0, width, height);

                    // 转换为压缩后的格式
                    const outputFormat = fileType === 'image/png' ? 'image/png' : 'image/jpeg';
                    const compressedBase64 = canvas.toDataURL(outputFormat, IMAGE_COMPRESSION_CONFIG.quality);

                    // 计算压缩后大小
                    const compressedSize = Math.round((compressedBase64.length - 'data:image/jpeg;base64,'.length) * 3 / 4);

                    resolve({
                        data: compressedBase64,
                        size: compressedSize,
                        width: width,
                        height: height,
                        format: outputFormat
                    });
                } catch (error) {
                    reject(new Error(`图片压缩失败: ${error.message}`));
                }
            };

            img.onerror = function() {
                reject(new Error('图片加载失败'));
            };

            img.src = base64Data;
        } catch (error) {
            reject(error);
        }
    });
}

// 计算新尺寸（保持宽高比）
function calculateNewDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
        return { width: originalWidth, height: originalHeight };
    }

    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    const ratio = Math.min(widthRatio, heightRatio);

    return {
        width: Math.round(originalWidth * ratio),
        height: Math.round(originalHeight * ratio)
    };
}

// 验证图片文件
function validateImageFile(file) {
    // 检查文件大小
    if (file.size > IMAGE_COMPRESSION_CONFIG.maxFileSize) {
        throw new Error(`文件过大，最大支持 ${formatFileSize(IMAGE_COMPRESSION_CONFIG.maxFileSize)}`);
    }

    // 检查文件类型
    if (!IMAGE_COMPRESSION_CONFIG.supportedFormats.includes(file.type.toLowerCase())) {
        throw new Error(`不支持的文件格式: ${file.type}`);
    }

    return true;
}

function clearFeedbackForm() {
    document.getElementById('feedback-text').value = '';
    selectedImages = [];
    updateImagePreviews();
}

// 默认快捷语内容
const DEFAULT_QUICK_PHRASE = `

---
- 当你需要询问用户问题时, 应请求用户提供反馈, 并使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.

- 每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。
`
// 获取自定义快捷语
function getCustomQuickPhrase() {
    const customPhrase = localStorage.getItem('mcp-custom-quick-phrase');
    return customPhrase || DEFAULT_QUICK_PHRASE;
}

// 保存自定义快捷语
function saveCustomQuickPhrase(phrase) {
    localStorage.setItem('mcp-custom-quick-phrase', phrase);
}

// 显示快捷语编辑器
function showQuickPhraseEditor() {
    const modal = document.getElementById('quick-phrase-modal');
    const textarea = document.getElementById('custom-quick-phrase');
    
    // 加载当前的快捷语内容
    textarea.value = getCustomQuickPhrase();
    
    modal.style.display = 'flex';
    
    // 点击背景关闭模态框
    modal.onclick = function(e) {
        if (e.target === modal) {
            hideQuickPhraseEditor();
        }
    };
}

// 隐藏快捷语编辑器
function hideQuickPhraseEditor() {
    const modal = document.getElementById('quick-phrase-modal');
    modal.style.display = 'none';
}

// 保存快捷语
function saveQuickPhrase() {
    const textarea = document.getElementById('custom-quick-phrase');
    const phrase = textarea.value;
    
    saveCustomQuickPhrase(phrase);
    hideQuickPhraseEditor();
    showStatusMessage('success', '快捷语已保存');
}

// 恢复默认快捷语
function resetQuickPhrase() {
    const textarea = document.getElementById('custom-quick-phrase');
    textarea.value = DEFAULT_QUICK_PHRASE;
    showStatusMessage('info', '已恢复为默认快捷语');
}

// 为反馈文本框添加粘贴图片功能
document.getElementById('feedback-text').addEventListener('paste', function(e) {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); // 阻止默认粘贴行为
            
            const blob = item.getAsFile();
            if (blob) {
                const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                try {
                    validateImageFile(file);
                    addImage(file);
                } catch (error) {
                    showStatusMessage('error', `粘贴图片失败: ${error.message}`);
                }
            }
            break;
        }
    }
});

// 设置平台相关的快捷键提示
function setupShortcutHint() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutKeysElement = document.getElementById('shortcut-keys');
    const submitBtn = document.getElementById('submit-feedback-btn');
    
    if (shortcutKeysElement && submitBtn) {
        if (isMac) {
            shortcutKeysElement.textContent = 'Cmd+Enter';
            submitBtn.title = '快捷键: Cmd+Enter';
        } else {
            shortcutKeysElement.textContent = 'Ctrl+Enter';
            submitBtn.title = '快捷键: Ctrl+Enter';
        }
    }
}

// 添加快捷键支持 (Cmd+Enter for Mac, Ctrl+Enter for Windows)
document.addEventListener('keydown', function(e) {
    // 检查是否按下了 Cmd+Enter (Mac) 或 Ctrl+Enter (Windows)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isShortcut = (isMac && e.metaKey && e.key === 'Enter') || 
                      (!isMac && e.ctrlKey && e.key === 'Enter');
    
    if (isShortcut) {
        // 检查当前焦点是否在反馈表单区域内
        const activeElement = document.activeElement;
        const feedbackForm = document.getElementById('feedback-form');
        const feedbackTextarea = document.getElementById('feedback-text');
        
        // 如果焦点在反馈文本框内或表单内，触发提交
        if (feedbackForm && (feedbackForm.contains(activeElement) || activeElement === feedbackTextarea)) {
            e.preventDefault();
            
            // 触发表单提交事件
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            feedbackForm.dispatchEvent(submitEvent);
        }
    }
});

// 提交反馈
document.getElementById('feedback-form').addEventListener('submit', function(e) {
    e.preventDefault();

    let feedbackText = document.getElementById('feedback-text').value.trim();

    // 检查是否需要附加快捷语
    const addQuickPhrase = document.getElementById('add-quick-phrase').checked;
    if (addQuickPhrase && feedbackText) {
        feedbackText += getCustomQuickPhrase();
    }

    console.log('提交反馈:', {
        text: feedbackText,
        images: selectedImages.length,
        session: currentFeedbackSession,
        connected: isConnected
    });

    if (!feedbackText && selectedImages.length === 0) {
        showStatusMessage('error', '请输入反馈内容或选择图片');
        return;
    }

    if (!isConnected) {
        showStatusMessage('error', '连接已断开，请刷新页面重试');
        return;
    }

    // 检查会话ID
    if (!currentFeedbackSession) {
        showStatusMessage('error', '当前为演示模式，请通过MCP工具函数调用来创建正式的反馈会话');
        console.log('演示模式 - 反馈内容:', {
            text: feedbackText,
            images: selectedImages.length,
            timestamp: new Date().toLocaleString()
        });

        // 显示演示反馈
        showStatusMessage('info', '演示反馈已记录到控制台，请查看浏览器开发者工具');
        clearFeedbackForm();
        return;
    }

    // 禁用提交按钮
    const submitBtn = document.getElementById('submit-feedback-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '提交中...';

    // 发送反馈数据
    const feedbackData = {
        text: feedbackText,
        images: selectedImages.map(img => ({
            name: img.name,
            data: img.data,
            size: img.size,
            type: img.type
        })),
        timestamp: Date.now(),
        sessionId: currentFeedbackSession
    };

    console.log('发送反馈数据:', feedbackData);
    socket.emit('submit_feedback', feedbackData);

    // 5秒后重新启用按钮（防止卡住）
    setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '提交反馈';
    }, 5000);
});

// 显示工作汇报内容
function displayWorkSummary(workSummary) {
    console.log('displayWorkSummary 被调用:', workSummary);

    if (!workSummary || workSummary.trim() === '') {
        console.log('工作汇报内容为空');
        return;
    }

    // 隐藏默认消息
    const defaultMessage = document.getElementById('default-message');
    if (defaultMessage) {
        defaultMessage.style.display = 'none';
    }

    // 找到左栏的卡片体
    const leftColumn = document.querySelector('.left-column .card-body');
    if (!leftColumn) {
        console.error('找不到左栏卡片体元素');
        return;
    }

    // 检查是否已经有工作汇报内容
    const existingContent = leftColumn.querySelector('.work-summary-content');
    if (existingContent) {
        existingContent.remove();
    }

    // 创建工作汇报内容
    const workSummaryDiv = document.createElement('div');
    workSummaryDiv.className = 'work-summary-content';
    workSummaryDiv.innerHTML = workSummary.replace(/\n/g, '<br>');

    // 添加到左栏卡片体中
    leftColumn.appendChild(workSummaryDiv);

    console.log('AI工作汇报内容已添加到左栏');

    // 添加样式（只添加一次）
    if (!document.querySelector('#work-summary-styles')) {
        const style = document.createElement('style');
        style.id = 'work-summary-styles';
        style.textContent = `
            .work-summary-content {
                color: #cccccc;
                line-height: 1.6;
                font-size: 13px;
                white-space: pre-wrap;
                word-wrap: break-word;
                background: #1e1e1e;
                padding: 16px;
                border-radius: 4px;
                border: 1px solid #3e3e42;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(style);
    }
}

// ==================== 工作汇报刷新功能 ====================

/**
 * 显示刷新状态
 */
function showRefreshStatus(type, message) {
    const statusText = document.getElementById('refresh-status-text');
    if (!statusText) return;

    statusText.className = `refresh-status-text ${type}`;
    statusText.textContent = message;

    // 如果是成功或错误状态，2秒后自动清空
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusText.textContent = '';
            statusText.className = 'refresh-status-text';
        }, 2000);
    }
}

/**
 * 隐藏刷新状态
 */
function hideRefreshStatus() {
    const statusText = document.getElementById('refresh-status-text');
    if (statusText) {
        statusText.textContent = '';
        statusText.className = 'refresh-status-text';
    }
}

/**
 * 手动刷新工作汇报
 */
function refreshWorkSummary() {
    console.log('手动刷新工作汇报');

    const refreshBtn = document.getElementById('refresh-report-btn');
    const refreshText = document.getElementById('refresh-text');

    if (!refreshBtn || !refreshText) {
        console.error('找不到刷新按钮元素');
        return;
    }

    if (isConnected && socket) {
        // 显示加载状态
        refreshText.textContent = '正在获取最新工作汇报...';
        showRefreshStatus('loading', '正在获取最新工作汇报...');

        // 请求最新的工作汇报
        socket.emit('request_latest_summary');

        // 5秒后恢复按钮文字（防止卡住）
        setTimeout(() => {
            refreshText.textContent = '刷新最新汇报';
            hideRefreshStatus();
        }, 5000);
    } else {
        // 连接断开时的处理
        showRefreshStatus('error', '连接已断开，无法刷新');
    }
}



/**
 * 开始自动刷新
 */
function startAutoRefresh() {
    console.log('开始自动刷新');

    // 清除现有的定时器
    stopAutoRefresh();

    // 重置倒计时
    autoRefreshCountdown = 10;
    updateAutoRefreshCountdown();

    // 设置倒计时定时器
    autoRefreshTimer = setInterval(() => {
        autoRefreshCountdown--;
        updateAutoRefreshCountdown();

        if (autoRefreshCountdown <= 0) {
            // 执行刷新
            refreshWorkSummary();
            // 重置倒计时
            autoRefreshCountdown = 10;
        }
    }, 1000);

    console.log('自动刷新已启用，每10秒刷新一次');
}

/**
 * 停止自动刷新
 */
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }

    autoRefreshCountdown = 10;
    updateAutoRefreshCountdown();

    console.log('自动刷新已停止');
}

/**
 * 更新自动刷新倒计时显示
 */
function updateAutoRefreshCountdown() {
    const countdownEl = document.getElementById('auto-refresh-countdown');
    const statusText = document.getElementById('refresh-status-text');

    if (countdownEl) {
        countdownEl.textContent = autoRefreshCountdown;
    }

    if (statusText) {
        statusText.textContent = `下次自动刷新：${autoRefreshCountdown}秒后`;
        statusText.className = 'refresh-status-text';
    }
}



// 获取版本信息
async function fetchVersionInfo() {
    try {
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            updateVersionDisplay(data.version);
        } else {
            console.log('无法获取版本信息，使用默认版本');
        }
    } catch (error) {
        console.log('获取版本信息失败:', error);
    }
}

// 更新版本显示
function updateVersionDisplay(version) {
    const versionElement = document.getElementById('version-number');
    if (versionElement && version) {
        versionElement.textContent = version;
    }
}

// ==================== 图片预览功能 ====================

/**
 * 显示图片预览
 */
function showImagePreview(index) {
    if (index < 0 || index >= selectedImages.length) {
        console.error('无效的图片索引:', index);
        return;
    }

    const image = selectedImages[index];
    const modal = document.getElementById('image-preview-modal');
    const previewImg = document.getElementById('preview-image-large');
    const infoDiv = document.getElementById('image-preview-info');

    // 设置图片源
    previewImg.src = image.data;
    previewImg.alt = image.name;

    // 设置图片信息
    const sizeText = formatFileSize(image.size);
    infoDiv.textContent = `${image.name} (${sizeText})`;

    // 显示模态框
    modal.classList.add('show');

    // 点击背景关闭模态框
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeImagePreview();
        }
    };

    // ESC键关闭模态框
    document.addEventListener('keydown', handleImagePreviewKeydown);
}

/**
 * 关闭图片预览
 */
function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    modal.classList.remove('show');
    
    // 移除键盘事件监听
    document.removeEventListener('keydown', handleImagePreviewKeydown);
}

/**
 * 处理图片预览的键盘事件
 */
function handleImagePreviewKeydown(e) {
    if (e.key === 'Escape') {
        closeImagePreview();
    }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== 反馈提交成功处理 ====================

/**
 * 显示反馈提交成功消息并开始倒计时关闭页面
 */
function showFeedbackSuccessWithCountdown() {
    let countdown = 3;
    
    // 创建持续显示的成功消息（不包含emoji，因为showStatusMessage会自动添加）
    const toastDiv = showStatusMessage('success', `反馈提交成功！感谢您的宝贵意见。页面将在 ${countdown} 秒后自动关闭...`, false);
    
    // 开始倒计时
    const countdownTimer = setInterval(() => {
        countdown--;
        
        if (countdown > 0) {
            // 更新消息内容
            const messageEl = toastDiv.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = `反馈提交成功！感谢您的宝贵意见。页面将在 ${countdown} 秒后自动关闭...`;
            }
        } else {
            // 倒计时结束，关闭页面
            clearInterval(countdownTimer);
            
            // 更新最终消息
            const messageEl = toastDiv.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = '反馈提交成功！正在关闭页面...';
            }
            
            // 延迟500ms后关闭页面，让用户看到最终消息
            setTimeout(() => {
                window.close();
            }, 500);
        }
    }, 1000);
}
