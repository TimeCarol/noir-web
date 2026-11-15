/**
 * 职责: 统一 Radix 色阶, 三档字号和克制的组件视觉
 * 导出: ThemeMode, palette, createTheme
 * 依赖: Radix UI Colors / Ant Design token
 * 约束: 禁止自造颜色, 色阶用途遵循 Radix 官方规范
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import {
  slate,
  slateDark,
  iris,
  irisDark,
  jade,
  jadeDark,
  amber,
  amberDark,
  tomato,
  tomatoDark,
  cyan,
  cyanDark,
  whiteA,
  blackA,
} from '@radix-ui/colors';
import type { ThemeConfig } from 'antd';

/** ThemeMode 是持久保存的用户选择, system 的实际配色由系统决定 */
export type ThemeMode = 'system' | 'light' | 'dark';

/** palette 选择 Radix 原始色阶, 图表和组件使用同一来源 */
export function palette(dark: boolean) {
  return dark
    ? { slate: slateDark, iris: irisDark, jade: jadeDark, amber: amberDark, tomato: tomatoDark, cyan: cyanDark }
    : { slate, iris, jade, amber, tomato, cyan };
}

/** createTheme 将 Radix 色阶按官方用途映射到 Ant Design 语义 token */
export function createTheme(dark: boolean): ThemeConfig {
  const colors = palette(dark);
  const neutral = colors.slate;
  const primary = colors.iris;
  const semantic = Object.fromEntries(
    (
      [
        ['Primary', primary, 'iris'],
        ['Info', primary, 'iris'],
        ['Success', colors.jade, 'jade'],
        ['Warning', colors.amber, 'amber'],
        ['Error', colors.tomato, 'tomato'],
      ] as const
    ).flatMap(([name, scale, prefix]) => {
      const values = scale as Record<string, string>;
      return [
        [`color${name}`, values[`${prefix}9`]],
        [`color${name}Hover`, values[`${prefix}10`]],
        [`color${name}Active`, values[`${prefix}10`]],
        [`color${name}Bg`, values[`${prefix}3`]],
        [`color${name}BgHover`, values[`${prefix}4`]],
        [`color${name}Border`, values[`${prefix}7`]],
        [`color${name}BorderHover`, values[`${prefix}8`]],
        [`color${name}Text`, values[`${prefix}11`]],
        [`color${name}TextHover`, values[`${prefix}12`]],
        [`color${name}TextActive`, values[`${prefix}12`]],
      ];
    }),
  );
  return {
    token: {
      ...semantic,
      colorBgBase: neutral.slate1,
      colorBgLayout: neutral.slate1,
      colorBgContainer: neutral.slate2,
      colorBgElevated: neutral.slate2,
      colorBgSpotlight: dark ? neutral.slate4 : neutral.slate12,
      colorBgMask: blackA.blackA8,
      colorTextBase: neutral.slate12,
      colorText: neutral.slate12,
      colorTextSecondary: neutral.slate11,
      colorTextTertiary: neutral.slate11,
      colorTextQuaternary: neutral.slate11,
      colorTextDisabled: neutral.slate11,
      colorTextLightSolid: whiteA.whiteA12,
      colorWhite: whiteA.whiteA12,
      colorBgTextHover: neutral.slate3,
      colorBgTextActive: neutral.slate4,
      colorTextPlaceholder: neutral.slate11,
      colorIcon: neutral.slate11,
      colorIconHover: neutral.slate12,
      colorBorder: neutral.slate7,
      colorBorderSecondary: neutral.slate6,
      colorSplit: neutral.slate6,
      colorFill: neutral.slate5,
      colorFillSecondary: neutral.slate4,
      colorFillTertiary: neutral.slate3,
      colorFillQuaternary: neutral.slate2,
      colorBgContainerDisabled: neutral.slate3,
      controlItemBgHover: neutral.slate3,
      controlItemBgActive: primary.iris5,
      controlItemBgActiveHover: primary.iris4,
      controlOutline: primary.iris8,
      controlOutlineWidth: 0.5,
      colorLink: primary.iris11,
      colorLinkHover: primary.iris12,
      colorLinkActive: primary.iris11,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 14,
      fontSizeSM: 12,
      fontSizeLG: 14,
      fontSizeXL: 24,
      fontSizeHeading1: 24,
      fontSizeHeading2: 24,
      fontSizeHeading3: 14,
      fontSizeHeading4: 14,
      fontSizeHeading5: 14,
      lineWidth: 0.5,
      borderRadius: 6,
      borderRadiusLG: 12,
      borderRadiusSM: 4,
      controlHeight: 36,
      motion: false,
      boxShadow: 'none',
      boxShadowSecondary: 'none',
      boxShadowTertiary: 'none',
    },
    components: {
      Layout: { headerBg: neutral.slate1, bodyBg: neutral.slate1 },
      Table: {
        headerBg: neutral.slate2,
        headerColor: neutral.slate11,
        borderColor: neutral.slate6,
        rowHoverBg: neutral.slate3,
        cellPaddingBlock: 18,
        cellPaddingInline: 20,
        headerSplitColor: 'transparent',
      },
      Card: { headerFontSize: 14, headerHeight: 64, bodyPadding: 24 },
      Tag: { defaultBg: neutral.slate3, defaultColor: neutral.slate11 },
      Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
      Input: { activeShadow: 'none' },
      Steps: { iconSize: 26, iconFontSize: 12 },
    },
  };
}