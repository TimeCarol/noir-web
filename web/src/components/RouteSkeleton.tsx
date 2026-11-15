/**
 * 职责: 为懒加载页面提供低干扰的加载占位
 * 导出: RouteSkeleton
 * 依赖: 无
 * 约束: 只使用骨架条和可访问名称, 不显示解释文字
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
/** RouteSkeleton 在弱网加载路由时保留页面结构 */
export function RouteSkeleton() {
  return (
    <div className="route-skeleton" role="status" aria-label="正在加载页面">
      <span />
      <span />
      <span />
    </div>
  );
}