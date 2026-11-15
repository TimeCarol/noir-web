/**
 * 职责: 调整桌面侧栏宽度并保存浏览器偏好
 * 导出: SidebarResizeHandle, readSidebarWidth
 * 依赖: React / Pointer Capture / localStorage
 * 约束: 宽度限制为 200 至 400px, 拖拽结束后保存, 捕获随元素生命周期释放
 * 作者: timecarol
 * 日期: 2026-11-15 22:45
 * 版本: v1.0
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const minimumWidth = 200;
const maximumWidth = 400;
const defaultWidth = 256;
const storageKey = 'noir-sidebar-width';

/** readSidebarWidth 读取合法像素值, 存储不可用时沿用默认宽度 */
export function readSidebarWidth(): number {
  try {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved >= minimumWidth && saved <= maximumWidth ? Math.round(saved) : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

/** constrainWidth 将连续位移限制为可用的整数像素宽度 */
function constrainWidth(width: number): number {
  return Math.round(Math.max(minimumWidth, Math.min(maximumWidth, width)));
}

/** saveSidebarWidth 仅保存完成的交互, 禁止存储时当前宽度仍生效 */
function saveSidebarWidth(width: number) {
  try {
    localStorage.setItem(storageKey, String(width));
  } catch {
    // 浏览器禁止持久存储时当前页面仍使用本次宽度
  }
}

/** SidebarResizeHandle 通过边界拖拽或方向键调整宽度
 * @param props 当前展开宽度和只更新页面布局的回调
 * @returns 可聚焦的竖直分隔条
 */
export function SidebarResizeHandle({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number; width: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  /** startResize 捕获主指针, 离开窄边界后仍接收同一次拖动 */
  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, width };
    setResizing(true);
  }

  /** moveResize 按拖动起点计算宽度, 不依赖事件次数 */
  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.width = constrainWidth(active.startWidth + event.clientX - active.startX);
    onChange(active.width);
  }

  /** finishResize 保存最后显示的宽度, 取消和丢失捕获也结束交互 */
  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    saveSidebarWidth(drag.current.width);
    drag.current = null;
    setResizing(false);
  }

  /** resizeWithKeyboard 提供方向键及上下限跳转 */
  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const values: Record<string, number> = {
      ArrowLeft: width - 10,
      ArrowRight: width + 10,
      Home: minimumWidth,
      End: maximumWidth,
    };
    const value = values[event.key];
    if (value === undefined) return;
    event.preventDefault();
    const next = constrainWidth(value);
    onChange(next);
    saveSidebarWidth(next);
  }

  return (
    <div
      className="sidebar-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label="调整侧栏宽度"
      aria-orientation="vertical"
      aria-controls="primary-sidebar"
      aria-valuemin={minimumWidth}
      aria-valuemax={maximumWidth}
      aria-valuenow={width}
      aria-valuetext={`${width} 像素`}
      data-resizing={resizing || undefined}
      onPointerDown={startResize}
      onPointerMove={moveResize}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
      onLostPointerCapture={finishResize}
      onKeyDown={resizeWithKeyboard}
    />
  );
}