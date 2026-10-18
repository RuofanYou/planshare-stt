/**
 * ui/ —— PlanShare 设计系统 SSOT 原语统一出口。
 * 整站消费方一处导入：import { Button, GlassCard, Tag, ... } from '@/components/ui'
 * （或相对路径 '../components/ui'）。新增原语只在此补一行导出。
 */
export { default as Icon } from './Icon'
export type { IconName, IconProps } from './Icon'

export { default as Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { default as GlassCard } from './GlassCard'
export type { GlassCardProps } from './GlassCard'

export { default as Tag } from './Tag'
export type { TagProps, TagVariant } from './Tag'

export { default as Avatar } from './Avatar'
export type { AvatarProps } from './Avatar'

export { default as Stat } from './Stat'
export type { StatProps } from './Stat'

export { default as Skeleton, SkeletonText, SkeletonCard } from './Skeleton'
export type { SkeletonProps, SkeletonTextProps } from './Skeleton'

export { default as EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { default as Breadcrumb } from './Breadcrumb'
export type { BreadcrumbProps, BreadcrumbItem } from './Breadcrumb'

export { default as SectionHeading } from './SectionHeading'
export type { SectionHeadingProps } from './SectionHeading'
