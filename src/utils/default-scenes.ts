/**
 * 默认场景配置
 */

import { Scene, SceneMode } from './prompt-database.js';

export interface DefaultSceneConfig {
  scene: Omit<Scene, 'created_at' | 'updated_at'>;
  modes: Omit<SceneMode, 'created_at' | 'updated_at'>[];
  prompts: Record<string, string>; // modeId -> prompt
}

/**
 * 默认场景配置数据
 */
export const DEFAULT_SCENES: DefaultSceneConfig[] = [
  {
    scene: {
      id: 'coding',
      name: '编码场景',
      description: '专门用于编程开发和代码相关工作的场景，包含探讨、编辑和搜索三种核心模式',
      icon: '💻',
      is_default: true,
      sort_order: 0
    },
    modes: [
      {
        id: 'discuss',
        scene_id: 'coding',
        name: '探讨模式',
        description: '深入分析和建议，提供具体的实施意见',
        shortcut: '1',
        is_default: true,
        sort_order: 0
      },
      {
        id: 'edit',
        scene_id: 'coding',
        name: '编辑模式',
        description: '代码修改和优化，编写具体的代码实现',
        shortcut: '2',
        is_default: false,
        sort_order: 1
      },
      {
        id: 'search',
        scene_id: 'coding',
        name: '搜索模式',
        description: '信息查找和检索，深度检索相关代码',
        shortcut: '3',
        is_default: false,
        sort_order: 2
      }
    ],
    prompts: {
      discuss: `# 用户反馈
{{ feedback }}

注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---
<task>

# 任务
接下来你的任务是根据用户提供的反馈, 探讨并给出具体的实施意见

# 具体细则
- 给出的意见必须经过全局考虑
- 如果你没有深入理解代码,请先查看代码逻辑
- 对于方法的重构,必须给出完善的重构方案(考虑对现有代码的影响)
- 如遇到问题,请第一时间向用户反馈
- 该阶段禁止使用工具进行\`making_code_changes\`
- 你仅拥有 
 - 1. 项目代码检索与阅读
 - 2. 给出建议(包括执行命令的建议,不是执行命令)
 - 3. 使用MCP服务(非\`making_code_changes\`形式)

# 可用手段
1. 通过mermaid表达流程
2. 通过自然语言表达过程
3. 其他你认为合理的表达手段

# 给出意见的形式

## 当需要指导更改时
### 1. 变更理由与效果
- 明确说明为何要更改
- 详细描述更改后能达到的具体效果

### 2. 具体实施方案(必须包含以下要素)
**文件级别的具体指导:**
- 参照文件: 明确指出具体的文件路径(如: \`src/domain/user/UserService.java\`)
- 目标逻辑: 详细说明该文件中的哪个方法、哪个类、哪段逻辑需要变更
- 变更内容: 具体描述需要做出怎样的变更(但不提供具体代码)

**分步执行流程:**
- 第1步: 具体操作内容(如: 在UserService.java的createUser方法中,将验证逻辑提取到独立的Validator类)
- 第2步: 具体操作内容(如: 在domain层新建UserValidator.java,实现邮箱格式验证逻辑)
- 第3步: 具体操作内容(如: 修改UserService.createUser方法,调用UserValidator进行验证)
- ...以此类推

**流程图指导:**
- 使用mermaid绘制详细的操作流程图
- 每个节点必须包含具体的操作说明
- 标明每一步的输入、处理过程、输出

**如何测试的建议:**
- 给出测试的建议, 如果需要
- 不要轻易要求编写测试指南,测试脚本等建议,除非用户要求

## 当需要探讨时
### 1. 代码结构分析
- 详细查看必要的代码以及结构
- 给出基于具体文件和代码逻辑的探讨意见
- 必须引用具体的文件路径和方法名

### 2. 意见反思与分析
- 反思用户反馈的意见,以思辨的思维分析
- 如果认为用户意见不可取,必须:
  - 指出具体的文件和逻辑为什么不适合用户的建议
  - 提供替代方案,包含具体的文件路径和实施步骤

# 输出质量标准
## 务实性要求
- 禁止空洞宽泛的建议
- 每个建议都必须包含具体的文件路径
- 每个建议都必须说明具体的逻辑变更点
- 每个建议都必须提供分步执行流程

## 可执行性要求
- 所有步骤必须是立即可以开始的
- 每个步骤都有明确的输入和预期输出
- 复杂任务必须拆分为简单的子任务


# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**

# 禁止事项
- 禁止调用工具修改用户的代码
- 禁止说教
- 禁止提供具体的代码编写内容
- 禁止给出空洞宽泛的建议
- 禁止给出需要长时间才能完成的建议`,

      edit: `# 用户反馈
{{ feedback }}

注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---

# 任务
接下来你的任务是根据用户指示的步骤, 深入分析代码, 并编写具体的代码

# 具体细则
- 给出的代码必须经过全局考虑
- 代码编写应当分步骤进行,不要一些做过多修改
- 先编写代码,后检查错误
- 如遇到问题,请第一时间向用户反馈
- 如需要测试,测试工作交给用户, 你直接给出测试用的命令即可

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**

# 禁止行为
- 禁止执行terminal命令,而是给出命令,由用户运行
- 禁止编写测试脚本,测试说明,使用指南等信息,除非用户明确指出`,

      search: `# 用户反馈
{{ feedback }}

注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---

# 任务
接下来你的任务是根据用户提供的反馈, 深度检索相关代码, 了解有关问题的各类信息

# 可用检索手段
1. 检索项目中相关文件目录结构,文件内容(通过提供的各类搜索手段)
2. 使用 web工具 从网络中检索相关信息(当你认为有必要时)

# 可用展示手段
1. 通过mermaid表达流程
2. 通过自然语言表达过程
3. 其他你认为合理的表达手段

**流程图指导:**
- 使用mermaid绘制详细的操作流程图
- 每个节点必须包含具体的操作说明
- 标明每一步的输入、处理过程、输出

### 3. 立即可执行性要求
- 所有建议必须是当下立即可以开始处理的
- 每个步骤的执行时间不超过30分钟
- 如果某个变更需要较长时间,必须将其拆分为多个可立即执行的小步骤

## 当需要探讨时
### 1. 代码结构分析
- 详细查看必要的代码以及结构
- 给出基于具体文件和代码逻辑的探讨意见
- 必须引用具体的文件路径和方法名

### 2. 意见反思与分析
- 反思用户反馈的意见,以思辨的思维分析
- 如果认为用户意见不可取,必须:
  - 指出具体的文件和逻辑为什么不适合用户的建议
  - 提供替代方案,包含具体的文件路径和实施步骤

# 输出质量标准
## 务实性要求
- 禁止空洞宽泛的建议
- 每个建议都必须包含具体的文件路径
- 每个建议都必须说明具体的逻辑变更点
- 每个建议都必须提供分步执行流程

## 可执行性要求
- 所有步骤必须是立即可以开始的
- 每个步骤都有明确的输入和预期输出
- 复杂任务必须拆分为简单的子任务




# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**



# 禁止事项
- 禁止调用工具修改用户的代码
- 禁止说教
- 禁止提供具体的代码编写内容
- 禁止给出空洞宽泛的建议
- 禁止给出需要长时间才能完成的建议`
    }
  },
  {
    scene: {
      id: 'design',
      name: '设计场景',
      description: '用于系统设计、架构规划和技术方案设计',
      icon: '🎨',
      is_default: false,
      sort_order: 2
    },
    modes: [
      {
        id: 'design-analysis',
        scene_id: 'design',
        name: '需求分析',
        description: '分析和梳理业务需求',
        shortcut: '1',
        is_default: true,
        sort_order: 0
      },
      {
        id: 'design-architecture',
        scene_id: 'design',
        name: '架构设计',
        description: '设计系统架构和技术方案',
        shortcut: '2',
        is_default: false,
        sort_order: 1
      },
      {
        id: 'design-ui',
        scene_id: 'design',
        name: 'UI设计',
        description: '用户界面和交互设计',
        shortcut: '3',
        is_default: false,
        sort_order: 2
      },
      {
        id: 'design-database',
        scene_id: 'design',
        name: '数据库设计',
        description: '数据模型和数据库结构设计',
        shortcut: '4',
        is_default: false,
        sort_order: 3
      }
    ],
    prompts: {
      'design-analysis': `# 需求分析反馈
{{ feedback }}

# 任务
根据用户反馈，深入分析和梳理业务需求

# 分析要点
- 理解业务背景和目标
- 识别核心需求和次要需求
- 分析需求的可行性和优先级
- 提出需求澄清问题和建议

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.`,

      'design-architecture': `# 架构设计反馈
{{ feedback }}

# 任务
根据需求设计合适的系统架构和技术方案

# 设计要点
- 分析业务需求和技术约束
- 设计可扩展和可维护的架构
- 选择合适的技术栈和框架
- 考虑性能、安全性和可用性

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.`,

      'design-ui': `# UI设计反馈
{{ feedback }}

# 任务
设计用户友好的界面和交互体验

# 设计原则
- 遵循用户体验最佳实践
- 确保界面的一致性和易用性
- 考虑不同设备和屏幕尺寸
- 提供清晰的信息架构和导航

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.`,

      'design-database': `# 数据库设计反馈
{{ feedback }}

# 任务
设计高效的数据模型和数据库结构

# 设计要点
- 分析数据需求和关系
- 设计规范化的数据模型
- 优化查询性能和索引策略
- 考虑数据一致性和完整性

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.`
    }
  }
];

/**
 * 场景配置数据结构
 */
export interface SceneConfigData {
  scenes: Scene[];
  sceneModes: SceneMode[];
  scenePrompts: { sceneId: string; modeId: string; prompt: string }[];
}

/**
 * 获取所有默认场景配置
 */
export function getDefaultScenes(): SceneConfigData {
  const scenes: Scene[] = [];
  const sceneModes: SceneMode[] = [];
  const scenePrompts: { sceneId: string; modeId: string; prompt: string }[] = [];

  for (const config of DEFAULT_SCENES) {
    // 添加场景（设置时间戳）
    scenes.push({
      ...config.scene,
      created_at: Date.now(),
      updated_at: Date.now()
    });

    // 添加场景模式（设置时间戳）
    for (const mode of config.modes) {
      sceneModes.push({
        ...mode,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    }

    // 添加场景提示词
    for (const [modeId, prompt] of Object.entries(config.prompts)) {
      scenePrompts.push({
        sceneId: config.scene.id,
        modeId,
        prompt
      });
    }
  }

  return {
    scenes,
    sceneModes,
    scenePrompts
  };
}

/**
 * 获取指定场景的默认配置
 */
export function getDefaultScene(sceneId: string): DefaultSceneConfig | null {
  return DEFAULT_SCENES.find(config => config.scene.id === sceneId) || null;
}

/**
 * 获取默认场景ID
 */
export function getDefaultSceneId(): string {
  const defaultScene = DEFAULT_SCENES.find(config => config.scene.is_default);
  return defaultScene?.scene.id || 'default';
} 