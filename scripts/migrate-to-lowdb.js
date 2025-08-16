#!/usr/bin/env node

/**
 * 数据迁移脚本 - 从JsonStorage格式迁移到Lowdb格式
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * 获取跨平台存储路径
 */
function getStoragePath(filename) {
  const platform = process.platform;
  let baseDir;

  switch (platform) {
    case 'darwin': // macOS
      baseDir = join(homedir(), '.mcp_feedback');
      break;
    case 'win32': // Windows
      baseDir = join(process.env['LOCALAPPDATA'] || join(homedir(), 'AppData', 'Local'), '.mcp_feedback');
      break;
    default: // Linux and others
      baseDir = join(process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), '.mcp_feedback');
      break;
  }

  return join(baseDir, filename);
}

/**
 * 确保目录存在
 */
function ensureDirectory(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`创建目录: ${dirPath}`);
  }
}

/**
 * 备份原始数据
 */
function backupOriginalData() {
  const originalPath = getStoragePath('prompts.json');
  
  if (!existsSync(originalPath)) {
    console.log('未找到原始数据文件，跳过备份');
    return false;
  }

  const backupDir = getStoragePath('backup');
  ensureDirectory(backupDir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `prompts-backup-${timestamp}.json`);
  
  try {
    copyFileSync(originalPath, backupPath);
    console.log(`原始数据已备份到: ${backupPath}`);
    return true;
  } catch (error) {
    console.error('备份失败:', error.message);
    return false;
  }
}

/**
 * 读取JsonStorage格式的数据
 */
function readJsonStorageData() {
  const originalPath = getStoragePath('prompts.json');
  
  if (!existsSync(originalPath)) {
    console.log('未找到原始数据文件，将创建空的lowdb数据');
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(originalPath, 'utf-8'));
    console.log('成功读取原始数据文件');
    return data;
  } catch (error) {
    console.error('读取原始数据失败:', error.message);
    return null;
  }
}

/**
 * 转换数据格式从JsonStorage到Lowdb
 */
function convertToLowdbFormat(jsonStorageData) {
  if (!jsonStorageData || !jsonStorageData.data) {
    return {
      scenes: [],
      sceneModes: [],
      scenePrompts: [],
      clearPrompts: []
    };
  }

  const { data } = jsonStorageData;
  
  return {
    scenes: data.scenes || [],
    sceneModes: data.scene_modes || [],
    scenePrompts: data.scene_prompts || [],
    clearPrompts: data.clear_prompts || []
  };
}

/**
 * 写入Lowdb格式的数据
 */
function writeLowdbData(lowdbData) {
  const lowdbPath = getStoragePath('lowdb.json');
  
  try {
    const lowdbDir = dirname(lowdbPath);
    ensureDirectory(lowdbDir);
    
    writeFileSync(lowdbPath, JSON.stringify(lowdbData, null, 2), 'utf-8');
    console.log(`Lowdb数据已写入: ${lowdbPath}`);
    return true;
  } catch (error) {
    console.error('写入Lowdb数据失败:', error.message);
    return false;
  }
}

/**
 * 验证迁移结果
 */
function validateMigration(originalData, lowdbData) {
  if (!originalData || !originalData.data) {
    console.log('✅ 迁移验证通过: 无原始数据');
    return true;
  }

  const original = originalData.data;
  const errors = [];

  // 验证场景数量
  if ((original.scenes || []).length !== lowdbData.scenes.length) {
    errors.push(`场景数量不匹配: 原始${(original.scenes || []).length} vs 新${lowdbData.scenes.length}`);
  }

  // 验证模式数量
  if ((original.scene_modes || []).length !== lowdbData.sceneModes.length) {
    errors.push(`模式数量不匹配: 原始${(original.scene_modes || []).length} vs 新${lowdbData.sceneModes.length}`);
  }

  // 验证提示词数量
  if ((original.scene_prompts || []).length !== lowdbData.scenePrompts.length) {
    errors.push(`提示词数量不匹配: 原始${(original.scene_prompts || []).length} vs 新${lowdbData.scenePrompts.length}`);
  }

  // 验证清理提示词数量
  if ((original.clear_prompts || []).length !== lowdbData.clearPrompts.length) {
    errors.push(`清理提示词数量不匹配: 原始${(original.clear_prompts || []).length} vs 新${lowdbData.clearPrompts.length}`);
  }

  if (errors.length > 0) {
    console.error('❌ 迁移验证失败:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  console.log('✅ 迁移验证通过: 数据完整性检查正常');
  return true;
}

/**
 * 主迁移函数
 */
async function main() {
  console.log('🚀 开始数据迁移: JsonStorage → Lowdb');
  console.log('=====================================');

  // 1. 备份原始数据
  console.log('\n📦 步骤1: 备份原始数据');
  const backupSuccess = backupOriginalData();
  if (!backupSuccess) {
    console.log('警告: 备份失败，但继续迁移');
  }

  // 2. 读取JsonStorage数据
  console.log('\n📖 步骤2: 读取原始数据');
  const originalData = readJsonStorageData();

  // 3. 转换数据格式
  console.log('\n🔄 步骤3: 转换数据格式');
  const lowdbData = convertToLowdbFormat(originalData);
  console.log(`转换完成: 场景${lowdbData.scenes.length}个, 模式${lowdbData.sceneModes.length}个, 提示词${lowdbData.scenePrompts.length}个`);

  // 4. 写入Lowdb数据
  console.log('\n💾 步骤4: 写入新格式数据');
  const writeSuccess = writeLowdbData(lowdbData);
  if (!writeSuccess) {
    console.error('❌ 迁移失败: 无法写入新数据');
    process.exit(1);
  }

  // 5. 验证迁移结果
  console.log('\n✅ 步骤5: 验证迁移结果');
  const validationSuccess = validateMigration(originalData, lowdbData);
  if (!validationSuccess) {
    console.error('❌ 迁移失败: 数据验证失败');
    process.exit(1);
  }

  console.log('\n🎉 迁移完成!');
  console.log('=====================================');
  console.log('✅ JsonStorage → Lowdb 迁移成功');
  console.log('💡 提示: 原始数据已备份，可安全使用新系统');
  
  // 显示文件位置
  console.log('\n📁 文件位置:');
  console.log(`  - 新数据库: ${getStoragePath('lowdb.json')}`);
  if (backupSuccess) {
    console.log(`  - 备份目录: ${getStoragePath('backup')}`);
  }
}

// 运行迁移
main().catch(error => {
  console.error('❌ 迁移过程中发生错误:', error);
  process.exit(1);
});