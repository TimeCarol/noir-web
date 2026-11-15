/**
 * 职责: 为慢设备保留组件测试等待预算
 * 导出: slowComponentTests, componentDeadline
 * 依赖: 进程环境变量
 * 约束: 只扩大等待时间, 不改变断言和交互
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
/** slowComponentTests 标记显式启用的低性能设备测试配置 */
export const slowComponentTests = process.env.NOIR_TEST_SLOW === '1';

/** componentDeadline 按当前测试配置放大等待预算
 * @param milliseconds 普通设备的原始等待时间
 * @returns 当前配置下的等待时间
 */
export function componentDeadline(milliseconds: number): number {
  return slowComponentTests ? milliseconds * 12 : milliseconds;
}