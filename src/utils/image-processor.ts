/**
 * MCP Feedback Collector - 图片处理工具
 * 注意：图片压缩功能已移至前端处理，此类仅用于验证
 */

import { ImageData, MCPError } from '../types/index.js';
import { logger } from './logger.js';

/**
 * 支持的图片格式
 */
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'tiff'];

/**
 * 图片处理器类
 */
export class ImageProcessor {
  private maxFileSize: number;
  private maxWidth: number;
  private maxHeight: number;

  constructor(options: {
    maxFileSize?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {}) {
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxWidth = options.maxWidth || 2048;
    this.maxHeight = options.maxHeight || 2048;
  }

  /**
   * 验证图片格式
   */
  validateImageFormat(filename: string, mimeType: string): boolean {
    // 检查文件扩展名
    const ext = filename.toLowerCase().split('.').pop();
    if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
      return false;
    }

    // 检查MIME类型
    const validMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff'
    ];

    return validMimeTypes.includes(mimeType.toLowerCase());
  }

  /**
   * 验证图片大小
   */
  validateImageSize(size: number): boolean {
    return size > 0 && size <= this.maxFileSize;
  }

  /**
   * 从Base64数据中提取图片信息（简化版本，前端已处理）
   */
  getImageInfoFromBase64(base64Data: string): {
    format: string;
    width: number;
    height: number;
    size: number;
    hasAlpha: boolean;
  } {
    try {
      // 移除Base64前缀
      const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      // 从data URL中提取格式信息
      const formatMatch = base64Data.match(/^data:image\/([^;]+);base64,/);
      const format = formatMatch?.[1] || 'unknown';

      return {
        format: format,
        width: 0, // 前端已处理，不需要获取具体尺寸
        height: 0,
        size: buffer.length,
        hasAlpha: format === 'png' // 简单判断
      };
    } catch (error) {
      logger.error('获取图片信息失败:', error);
      throw new MCPError(
        'Failed to get image information',
        'IMAGE_INFO_ERROR',
        error
      );
    }
  }

  /**
   * 压缩图片（已移至前端处理）
   * @deprecated 此功能已移至前端处理，服务器端不再执行压缩
   */
  async compressImage(base64Data: string, options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}): Promise<string> {
    logger.warn('compressImage 已弃用：图片压缩功能已移至前端处理');
    return base64Data; // 直接返回原数据
  }

  /**
   * 验证图片数据（前端已完成压缩处理）
   */
  async validateAndProcessImage(imageData: ImageData): Promise<ImageData> {
    try {
      // 验证基本信息
      if (!imageData.name || !imageData.data || !imageData.type) {
        throw new MCPError(
          'Invalid image data: missing required fields',
          'INVALID_IMAGE_DATA'
        );
      }

      // 验证格式
      if (!this.validateImageFormat(imageData.name, imageData.type)) {
        throw new MCPError(
          `Unsupported image format: ${imageData.type}`,
          'UNSUPPORTED_FORMAT'
        );
      }

      // 验证大小
      if (!this.validateImageSize(imageData.size)) {
        throw new MCPError(
          `Image size ${imageData.size} exceeds limit ${this.maxFileSize}`,
          'IMAGE_TOO_LARGE'
        );
      }

      // 前端已完成压缩，直接返回数据
      logger.debug(`图片验证通过: ${imageData.name} (${imageData.size} bytes)`);
      return imageData;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      
      logger.error('图片验证失败:', error);
      throw new MCPError(
        'Failed to validate image',
        'IMAGE_VALIDATION_ERROR',
        error
      );
    }
  }

  /**
   * 批量处理图片
   */
  async processImages(images: ImageData[]): Promise<ImageData[]> {
    const results: ImageData[] = [];
    
    for (let i = 0; i < images.length; i++) {
      try {
        logger.debug(`处理图片 ${i + 1}/${images.length}: ${images[i]?.name}`);
        const processedImage = await this.validateAndProcessImage(images[i]!);
        results.push(processedImage);
      } catch (error) {
        logger.error(`处理图片 ${images[i]?.name} 失败:`, error);
        // 继续处理其他图片，但记录错误
        throw error;
      }
    }
    
    logger.info(`成功处理 ${results.length}/${images.length} 张图片`);
    return results;
  }

  /**
   * 生成图片缩略图（已移至前端处理）
   * @deprecated 此功能已移至前端处理
   */
  async generateThumbnail(base64Data: string, size: number = 150): Promise<string> {
    logger.warn('generateThumbnail 已弃用：缩略图功能已移至前端处理');
    return base64Data; // 直接返回原数据
  }

  /**
   * 获取图片统计信息
   */
  getImageStats(images: ImageData[]): {
    totalCount: number;
    totalSize: number;
    averageSize: number;
    formats: Record<string, number>;
  } {
    const stats = {
      totalCount: images.length,
      totalSize: 0,
      averageSize: 0,
      formats: {} as Record<string, number>
    };

    for (const image of images) {
      stats.totalSize += image.size;
      
      const format = image.type.split('/')[1] || 'unknown';
      stats.formats[format] = (stats.formats[format] || 0) + 1;
    }

    stats.averageSize = stats.totalCount > 0 ? stats.totalSize / stats.totalCount : 0;

    return stats;
  }
}
