// 从 Heroicons 导入需要的图标
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PlusIcon,
  LightBulbIcon,
  SparklesIcon,
  Cog6ToothIcon,
  HomeIcon,
  UserIcon,
  FolderIcon,
  DocumentIcon,
  ClockIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  StarIcon,
  BookmarkIcon,
  ShareIcon,
  ClipboardIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'

import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
  PlusIcon as PlusIconSolid,
  HeartIcon as HeartIconSolid,
  StarIcon as StarIconSolid
} from '@heroicons/vue/24/solid'

// 导出图标映射
export {
  // 状态图标 (outline)
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  
  // 状态图标 (solid)
  CheckCircleIconSolid,
  XCircleIconSolid,
  ExclamationTriangleIconSolid,
  InformationCircleIconSolid,
  
  // 操作图标
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PlusIcon,
  PlusIconSolid,
  
  // 界面图标
  LightBulbIcon,
  SparklesIcon,
  Cog6ToothIcon,
  HomeIcon,
  UserIcon,
  FolderIcon,
  DocumentIcon,
  ClockIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  HeartIconSolid,
  StarIcon,
  StarIconSolid,
  BookmarkIcon,
  ShareIcon,
  ClipboardIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentTextIcon
}

// 图标尺寸常量
export const ICON_SIZES = {
  xs: 'w-3 h-3',      // 12px
  sm: 'w-4 h-4',      // 16px  
  md: 'w-5 h-5',      // 20px
  lg: 'w-6 h-6',      // 24px
  xl: 'w-8 h-8',      // 32px
} as const

export type IconSize = keyof typeof ICON_SIZES 