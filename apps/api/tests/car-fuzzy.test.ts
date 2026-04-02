import { describe, it, expect } from 'vitest';
import { normalizeCarQuery, fuzzyMatchBrand, BRAND_ALIASES } from '../src/services/car-fuzzy';

describe('normalizeCarQuery', () => {
  it('中文品牌+英文型号 → 拆分加空格', () => {
    const result = normalizeCarQuery('理想L6');
    expect(result).toContain('理想 L6');
  });

  it('英文别名 → 映射为中文', () => {
    const result = normalizeCarQuery('Tesla Model 3');
    expect(result).toContain('特斯拉 Model 3');
  });

  it('小写别名 → 映射为中文', () => {
    const result = normalizeCarQuery('byd');
    expect(result).toContain('比亚迪');
  });

  it('已经正确的查询 → 原样返回', () => {
    const result = normalizeCarQuery('理想 L6');
    expect(result).toContain('理想 L6');
  });

  it('空字符串 → 返回空数组', () => {
    const result = normalizeCarQuery('');
    expect(result).toHaveLength(0);
  });
});

describe('fuzzyMatchBrand', () => {
  const brands = Object.keys(BRAND_ALIASES);

  it('精确匹配', () => {
    expect(fuzzyMatchBrand('理想', brands)).toBe('理想');
  });

  it('编辑距离 1 → 匹配', () => {
    expect(fuzzyMatchBrand('理像', brands)).toBe('理想');
  });

  it('编辑距离 1 → 匹配（小朋→小鹏）', () => {
    expect(fuzzyMatchBrand('小朋', brands)).toBe('小鹏');
  });

  it('不在列表中 → 返回 null', () => {
    expect(fuzzyMatchBrand('宝马', brands)).toBeNull();
  });

  it('编辑距离太大 → 返回 null', () => {
    expect(fuzzyMatchBrand('东风日产', brands)).toBeNull();
  });
});
