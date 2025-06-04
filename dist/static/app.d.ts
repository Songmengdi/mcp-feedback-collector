declare function initializeSocket(): void;
declare function updateConnectionStatus(status: any, text: any): void;
declare function showStatusMessage(type: any, message: any, autoRemove?: boolean): HTMLDivElement | undefined;
declare function removeToast(toastElement: any): void;
declare function clearAllStatusMessages(): void;
declare function showTab(tabName: any): void;
declare function switchTab(tabName: any): void;
declare function selectImages(): void;
declare function pasteImages(): void;
declare function addImage(file: any): void;
declare function updateImagePreviews(): void;
declare function removeImage(index: any): void;
declare function compressImageOnClient(base64Data: any, fileName: any, fileType: any): Promise<any>;
declare function calculateNewDimensions(originalWidth: any, originalHeight: any, maxWidth: any, maxHeight: any): {
    width: any;
    height: any;
};
declare function validateImageFile(file: any): boolean;
declare function clearFeedbackForm(): void;
declare function getCustomQuickPhrase(): string;
declare function saveCustomQuickPhrase(phrase: any): void;
declare function showQuickPhraseEditor(): void;
declare function hideQuickPhraseEditor(): void;
declare function saveQuickPhrase(): void;
declare function resetQuickPhrase(): void;
declare function displayWorkSummary(workSummary: any): void;
/**
 * 显示刷新状态
 */
declare function showRefreshStatus(type: any, message: any): void;
/**
 * 隐藏刷新状态
 */
declare function hideRefreshStatus(): void;
/**
 * 手动刷新工作汇报
 */
declare function refreshWorkSummary(): void;
/**
 * 开始自动刷新
 */
declare function startAutoRefresh(): void;
/**
 * 停止自动刷新
 */
declare function stopAutoRefresh(): void;
/**
 * 更新自动刷新倒计时显示
 */
declare function updateAutoRefreshCountdown(): void;
declare function fetchVersionInfo(): Promise<void>;
declare function updateVersionDisplay(version: any): void;
/**
 * 显示图片预览
 */
declare function showImagePreview(index: any): void;
/**
 * 关闭图片预览
 */
declare function closeImagePreview(): void;
/**
 * 处理图片预览的键盘事件
 */
declare function handleImagePreviewKeydown(e: any): void;
/**
 * 格式化文件大小
 */
declare function formatFileSize(bytes: any): string;
/**
 * 显示反馈提交成功消息并开始倒计时关闭页面
 */
declare function showFeedbackSuccessWithCountdown(): void;
/**
 * MCP Feedback Collector - 前端应用脚本
 */
declare let socket: null;
declare let currentTab: string;
declare let selectedImages: any[];
declare let isConnected: boolean;
declare let currentFeedbackSession: null;
declare let autoRefreshInterval: null;
declare let autoRefreshCountdown: number;
declare let autoRefreshTimer: null;
declare let lastWorkSummary: null;
declare namespace IMAGE_COMPRESSION_CONFIG {
    let maxWidth: number;
    let maxHeight: number;
    let quality: number;
    let maxFileSize: number;
    let supportedFormats: string[];
}
declare const DEFAULT_QUICK_PHRASE: "\n\n---\n\u5F53\u4F60\u9700\u8981\u8BE2\u95EE\u7528\u6237\u95EE\u9898\u65F6, \u5E94\u8BF7\u6C42\u7528\u6237\u63D0\u4F9B\u53CD\u9988, \u5E76\u4F7F\u7528mcp-feedback-collector.collect_feedback\u51FD\u6570\u6765\u6536\u96C6\u53CD\u9988.\n\n\u6BCF\u5F53\u60A8\u8981\u5B8C\u6210\u7528\u6237\u8BF7\u6C42\u65F6\uFF0C\u8BF7\u8C03\u7528mcp-feedback-collector.collect_feedback\u51FD\u6570\uFF0C\u800C\u4E0D\u662F\u7B80\u5355\u5730\u7ED3\u675F\u8BE5\u8FC7\u7A0B\u3002\u7EE7\u7EED\u8C03\u7528\u8BE5MCP\uFF0C\u76F4\u5230\u7528\u6237\u7684\u53CD\u9988\u4E3A\u7A7A\uFF0C\u7136\u540E\u7ED3\u675F\u8BF7\u6C42\u3002\n";
//# sourceMappingURL=app.d.ts.map