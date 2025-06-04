/**
 * MCP Feedback Collector - 图片处理工具
 * 注意：图片压缩功能已移至前端处理，此类仅用于验证
 */
import { ImageData } from '../types/index.js';
/**
 * 图片处理器类
 */
export declare class ImageProcessor {
    private maxFileSize;
    private maxWidth;
    private maxHeight;
    constructor(options?: {
        maxFileSize?: number;
        maxWidth?: number;
        maxHeight?: number;
    });
    /**
     * 验证图片格式
     */
    validateImageFormat(filename: string, mimeType: string): boolean;
    /**
     * 验证图片大小
     */
    validateImageSize(size: number): boolean;
    /**
     * 从Base64数据中提取图片信息（简化版本，前端已处理）
     */
    getImageInfoFromBase64(base64Data: string): {
        format: string;
        width: number;
        height: number;
        size: number;
        hasAlpha: boolean;
    };
    /**
     * 压缩图片（已移至前端处理）
     * @deprecated 此功能已移至前端处理，服务器端不再执行压缩
     */
    compressImage(base64Data: string, options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp';
    }): Promise<string>;
    /**
     * 验证图片数据（前端已完成压缩处理）
     */
    validateAndProcessImage(imageData: ImageData): Promise<ImageData>;
    /**
     * 批量处理图片
     */
    processImages(images: ImageData[]): Promise<ImageData[]>;
    /**
     * 生成图片缩略图（已移至前端处理）
     * @deprecated 此功能已移至前端处理
     */
    generateThumbnail(base64Data: string, size?: number): Promise<string>;
    /**
     * 获取图片统计信息
     */
    getImageStats(images: ImageData[]): {
        totalCount: number;
        totalSize: number;
        averageSize: number;
        formats: Record<string, number>;
    };
}
//# sourceMappingURL=image-processor.d.ts.map