export const BRAND_ALIASES: Record<string, string[]> = {
  '比亚迪': ['BYD', 'byd'],
  '特斯拉': ['Tesla', 'tesla', 'tsla'],
  '大众': ['VW', 'Volkswagen', 'volkswagen'],
  '小鹏': ['XPeng', 'xpeng'],
  '理想': ['Li Auto', 'LiAuto', 'li', 'lixiang'],
  '蔚来': ['NIO', 'nio'],
  '极氪': ['Zeekr', 'zeekr'],
  '问界': ['AITO', 'aito'],
  '零跑': ['Leapmotor', 'leapmotor'],
  '小米': ['Xiaomi', 'xiaomi'],
  '吉利': ['Geely', 'geely'],
  '吉利银河': ['Galaxy', 'galaxy'],
  '丰田': ['Toyota', 'toyota'],
  '奇瑞': ['Chery', 'chery'],
  '腾势': ['Denza', 'denza'],
  '深蓝': ['Deepal', 'deepal'],
  '哪吒': ['Neta', 'neta'],
  '岚图': ['Voyah', 'voyah'],
  '方程豹': [],
  '智界': [],
  '享界': [],
};

// 反向别名表
const REVERSE_ALIAS = new Map<string, string>();
for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
  for (const alias of aliases) {
    REVERSE_ALIAS.set(alias.toLowerCase(), brand);
  }
}

/**
 * 归一化查询：别名映射 + 中文品牌与英文型号拆分
 */
export function normalizeCarQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = new Set<string>();
  results.add(trimmed);

  // 别名映射（完整匹配）
  const lower = trimmed.toLowerCase();
  const mappedBrand = REVERSE_ALIAS.get(lower);
  if (mappedBrand) {
    results.add(mappedBrand);
    return [...results];
  }

  // 前缀别名匹配（如 "Tesla Model 3"）
  for (const [alias, brand] of REVERSE_ALIAS) {
    if (lower.startsWith(alias + ' ') || lower.startsWith(alias)) {
      const rest = trimmed.slice(alias.length).trim();
      if (rest) {
        results.add(`${brand} ${rest}`);
      } else {
        results.add(brand);
      }
    }
  }

  // 中文品牌 + 英文/数字型号拆分："理想L6" → "理想 L6"
  const splitMatch = trimmed.match(/^([\u4e00-\u9fa5]+)([A-Za-z0-9].*)$/);
  if (splitMatch) {
    results.add(`${splitMatch[1]} ${splitMatch[2]}`);
  }

  return [...results];
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * 模糊匹配品牌名：编辑距离 ≤ 1 视为匹配
 */
export function fuzzyMatchBrand(
  input: string,
  brands: string[],
): string | null {
  if (brands.includes(input)) return input;

  let bestMatch: string | null = null;
  let bestDist = Infinity;

  for (const brand of brands) {
    const dist = editDistance(input, brand);
    if (dist <= 1 && dist < bestDist) {
      bestDist = dist;
      bestMatch = brand;
    }
  }

  return bestMatch;
}
