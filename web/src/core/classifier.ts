/**
 * 职责: 根据包名和端点做可解释的厂商与类别归因
 * 导出: classifyVendor, classifyCategory
 * 依赖: core/models / core/exposure / core/domains
 * 约束: 包名前缀优先于域名投票, 基础设施域名不参与厂商归因
 * 作者: timecarol
 * 日期: 2026-11-15 23:35
 * 版本: v1.0
 */
import type { Category } from './models';
import { hostOf } from './exposure';
import { isIgnored } from './domains';

interface VendorRule {
  vendor: string;
  prefixes: string[];
}

const PACKAGE_RULES: VendorRule[] = [
  { vendor: 'OPPO', prefixes: ['com.heytap.', 'com.oplus.', 'com.coloros.', 'com.oppo.', 'com.nearme.'] },
  { vendor: 'vivo', prefixes: ['com.vivo.', 'com.bbk.'] },
  { vendor: 'Huawei', prefixes: ['com.huawei.', 'com.hihonor.'] },
  { vendor: 'Samsung', prefixes: ['com.samsung.', 'com.sec.android.'] },
  { vendor: 'Tencent', prefixes: ['com.tencent.'] },
  { vendor: 'ByteDance', prefixes: ['com.ss.android.', 'com.bytedance.'] },
  { vendor: 'Alibaba', prefixes: ['com.taobao.', 'com.tmall.', 'com.alibaba.', 'com.alipay.', 'com.eg.android.alipaygphone', 'com.ant.'] },
  { vendor: 'Baidu', prefixes: ['com.baidu.'] },
  { vendor: 'Xiaomi', prefixes: ['com.xiaomi.', 'com.miui.', 'com.mi.', 'miui.'] },
  { vendor: 'Google', prefixes: ['com.google.', 'com.android.vending', 'com.android.chrome', 'com.android.gms', 'com.android.gsf'] },
  { vendor: 'Meituan', prefixes: ['com.sankuai.', 'com.meituan.', 'com.dianping.'] },
  { vendor: 'Pinduoduo', prefixes: ['com.xunmeng.pinduoduo', 'com.xunmeng.'] },
  { vendor: 'JD', prefixes: ['com.jingdong.'] },
  { vendor: 'Bilibili', prefixes: ['tv.danmaku.bili', 'com.bilibili.'] },
  { vendor: 'Kuaishou', prefixes: ['com.smile.gifmaker', 'com.kuaishou.'] },
  { vendor: 'Weibo', prefixes: ['com.sina.weibo'] },
  { vendor: 'Sogou', prefixes: ['com.sohu.inputmethod.sogou', 'com.sogou.'] },
  { vendor: 'iFlytek', prefixes: ['com.iflytek.'] },
  { vendor: 'NetEase', prefixes: ['com.netease.', 'com.online.163.'] },
  { vendor: 'Mihoyo', prefixes: ['com.mihoyo.'] },
  { vendor: 'UnionPay', prefixes: ['com.unionpay.'] },
  { vendor: 'Umeng', prefixes: ['com.umeng.'] },
];

const VENDOR_DOMAINS: Record<string, string[]> = {
  Xiaomi: ['xiaomi.com', 'miui.com', 'mi.com', 'xiaomi.net'],
  OPPO: ['heytap.com', 'heytapmobi.com', 'oppomobile.com', 'coloros.com', 'oplus.com', 'nearme.com', 'wanyol.com'],
  vivo: ['vivo.com.cn', 'vivo.com', 'iqoo.com'],
  Huawei: ['huawei.com', 'hicloud.com', 'hihonor.com'],
  Samsung: ['samsung.com', 'samsungapps.com'],
  Tencent: ['qq.com', 'tencent.com', 'tencent-cloud.net', 'weixin.qq.com'],
  Alibaba: ['alibaba.com', 'aliyun.com', 'taobao.com', 'tmall.com', 'amap.com', 'ucweb.com', 'uc.cn', 'alipay.com'],
  Baidu: ['baidu.com', 'bdstatic.com', 'bcebos.com'],
  ByteDance: ['bytedance.com', 'bytcdn.com', 'zijieapi.com', 'snssdk.com', 'toutiao.com', 'tiktokv.com', 'pangle.io', 'oceanengine.com'],
  Google: ['google.com', 'googleapis.com', 'gstatic.com', 'youtube.com', 'android.com'],
  Meta: ['facebook.com', 'facebook.net', 'instagram.com', 'fb.com', 'whatsapp.com'],
  Meituan: ['meituan.com', 'dianping.com', 'sankuai.com'],
  Pinduoduo: ['pinduoduo.com', 'yangkeduo.com'],
  JD: ['jd.com', '360buy.com'],
  Bilibili: ['bilibili.com', 'hdslb.com'],
  Kuaishou: ['kuaishou.com', 'gifshow.com'],
  Weibo: ['weibo.com', 'weibo.cn', 'sina.com.cn'],
  Sogou: ['sogou.com', 'sogoucdn.com'],
  iFlytek: ['iflytek.com', 'voicecloud.cn'],
  NetEase: ['netease.com', '163.com', '126.net'],
  Mihoyo: ['mihoyo.com'],
  UnionPay: ['unionpay.com', '95516.com'],
  Umeng: ['umeng.com', 'umengcloud.com'],
  Firebase: ['firebase.com', 'firebaseio.com', 'crashlytics.com'],
};

const KNOWN: Record<string, Category> = {
  'com.miui.analytics': 'TELEMETRY',
  'com.miui.misightservice': 'TELEMETRY',
  'com.xiaomi.security.onetrack': 'TELEMETRY',
  'com.miui.powerinsight': 'TELEMETRY',
  'com.miui.securitycenter': 'SECURITY',
  'com.miui.securitycore': 'SECURITY',
  'com.miui.securityadd': 'SECURITY',
  'com.miui.securitymanager': 'SECURITY',
  'com.miui.guardprovider': 'SECURITY',
  'com.bsp.catchlog': 'SECURITY',
  'com.miui.cleanmaster': 'SECURITY',
  'com.miui.systemadsolution': 'ADS',
  'com.xiaomi.market': 'APP_STORE',
  'com.android.vending': 'APP_STORE',
  'com.mobiletools.systemhelper': 'CARRIER',
  'com.xiaomi.xmsf': 'PUSH',
  'com.xiaomi.digitalkey': 'SYSTEM',
  'com.miui.screenrecorder': 'SYSTEM',
  'com.android.systemui': 'SYSTEM',
  'com.tencent.mm': 'SOCIAL',
  'com.tencent.mobileqq': 'SOCIAL',
  'com.eg.android.alipaygphone': 'FINANCE',
  'com.taobao.taobao': 'SHOPPING',
  'com.jingdong.app.mall': 'SHOPPING',
  'com.xunmeng.pinduoduo': 'SHOPPING',
  'tv.danmaku.bili': 'MEDIA',
  'com.google.android.youtube': 'MEDIA',
};

const TELEMETRY = /(^|[./_-])(analytics|track|tracker|tracking|stat|stats|beacon|telemetry|misight|onetrack|logging)([./_-]|$)/;
const ADS = /(^|[./_-])(ads?|advert|advertising|doubleclick|pangle|sigmob)([./_-]|$)/;

/** classifyVendor 优先使用包名前缀, 否则按上报域名投票 */
export function classifyVendor(pkg: string, endpoints: readonly string[]): string | null {
  const name = pkg.toLowerCase();
  const packageRule = PACKAGE_RULES.find(rule => rule.prefixes.some(prefix => name.startsWith(prefix)));
  if (packageRule) return packageRule.vendor;

  const hosts = endpoints
    .map(hostOf)
    .filter((host): host is string => host !== null && !isIgnored(host));
  if (hosts.length === 0) return null;

  const scores = new Map<string, number>();
  for (const [vendor, domains] of Object.entries(VENDOR_DOMAINS)) {
    for (const host of hosts) {
      if (domains.some(domain => host === domain || host.endsWith(`.${domain}`))) {
        scores.set(vendor, (scores.get(vendor) ?? 0) + 1);
      }
    }
  }
  let winner: string | null = null;
  let winnerScore = 0;
  for (const [vendor, value] of scores) {
    if (value > winnerScore) {
      winner = vendor;
      winnerScore = value;
    }
  }
  return winner;
}

/** classifyCategory 使用已知包名, 关键字和系统兜底 */
export function classifyCategory(pkg: string, endpoints: readonly string[], permissions: readonly string[], isSystem = false): Category {
  const known = KNOWN[pkg.toLowerCase()];
  if (known) return known;

  const name = pkg.toLowerCase();
  const urls = endpoints.join(' ').toLowerCase();
  const both = `${name} ${urls}`;
  const nameHas = (...keys: string[]) => keys.some(key => name.includes(key));
  const urlHas = (...keys: string[]) => keys.some(key => urls.includes(key));

  if (nameHas('dm.wo.com.cn', '.simactivate', 'carrier') || urlHas('dm.wo.com.cn')) return 'CARRIER';
  if (nameHas('inputmethod', '.ime', 'sogou', 'iflytek')) return 'INPUT_METHOD';
  if (nameHas('market', 'vending', 'appstore')) return 'APP_STORE';
  if (nameHas('pay', 'wallet', 'unionpay', 'mipay', '.bank')) return 'FINANCE';
  if (nameHas('taobao', 'tmall', 'jingdong', 'pinduoduo', 'idlefish', 'meituan', 'dianping', '.shop')) return 'SHOPPING';
  if (nameHas('bili', 'youtube', 'netflix', 'spotify', 'music', 'video', 'douyin', 'kuaishou', 'iqiyi', 'youku')) return 'MEDIA';
  if (nameHas('browser', 'chrome', 'fileexplorer', 'translator', 'wps', 'notes', 'calculator', 'recorder', 'camera')) return 'TOOL';
  if (nameHas('migame', 'gamecenter', 'minigame', 'roblox', 'mihoyo', 'tmgp', 'game')) return 'GAME';
  if (nameHas('tencent.mm', 'whatsapp', 'instagram', 'telegram', 'twitter', 'facebook')) return 'SOCIAL';
  if (TELEMETRY.test(both)) return 'TELEMETRY';
  if (ADS.test(both)) return 'ADS';
  if (nameHas('security', 'guard', 'antivirus', 'virus', 'clean', 'catchlog')) return 'SECURITY';
  if (nameHas('voice', 'asr', 'speech', 'xiaoai', 'xiaomixiaoai', 'ai.engine', 'aiasst')) return 'AI_VOICE';
  if (nameHas('location', 'lbs', 'gps', 'map', 'amap', 'metoknlp')) return 'LOCATION';
  if (nameHas('push', 'xmsf', 'firebase', 'umeng', 'getui', 'jpush')) return 'PUSH';
  if (nameHas('systemui', '.settings', '.home', 'launcher')) return 'SYSTEM';
  return isSystem ? 'SYSTEM' : 'OTHER';
}