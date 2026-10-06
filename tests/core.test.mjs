// CORE 纯函数单元测试（vitest）。
// 运行：npm test  （CI 每次 push 自动执行）
// 注意：涉及「今天」的用例一律用相对日期构造，避免测试机时钟差异导致假失败。
import { describe, it, expect } from 'vitest';
import { loadCore } from '../scripts/extract-core.mjs';

const DAY = 86400000;
const base = loadCore();
const { normDateStr, numOrNull, normalizeRecord, normalizeWord, normalizeScore,
        esc, addDays, articleKey, guessType, parseD, fmtD, isWordDue } = base;

function daysAgoStr(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtD(d);
}
function rec(over = {}){
  return Object.assign({
    id: 'r' + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    date: daysAgoStr(0),
    exam: '2026年6月', set: '1', part: 'Part III Section A',
    type: '', level: '', genre: '',
    words: null, newWords: null, wrong: null, minutes: null,
    title: '', note: '',
  }, over);
}
function word(over = {}){
  return Object.assign({
    id: 'w1', word: 'reluctant', meaning: 'adj. 不情愿的', src: '',
    box: 0, addedAt: new Date().toISOString(), lastReviewAt: null,
  }, over);
}

describe('日期规范化 normDateStr', () => {
  it('接受合法日期并补零', () => {
    expect(normDateStr('2026-06-15')).toBe('2026-06-15');
    expect(normDateStr('2026-6-5')).toBe('2026-06-05');
  });
  it('拒绝不存在的日期', () => {
    expect(normDateStr('2026-02-30')).toBeNull();
    expect(normDateStr('2026-13-01')).toBeNull();
    expect(normDateStr('2026-00-10')).toBeNull();
  });
  it('拒绝非日期输入', () => {
    expect(normDateStr('abc')).toBeNull();
    expect(normDateStr('')).toBeNull();
    expect(normDateStr(null)).toBeNull();
    expect(normDateStr(20260615)).toBeNull();
    expect(normDateStr('2026年6月15日')).toBeNull();
  });
});

describe('数值净化 numOrNull', () => {
  it('空值返回 null', () => {
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull('')).toBeNull();
    expect(numOrNull(undefined)).toBeNull();
  });
  it('非法与非正数返回 null', () => {
    expect(numOrNull('abc')).toBeNull();
    expect(numOrNull(-3)).toBeNull();
    expect(numOrNull(0)).toBeNull();
    expect(numOrNull(Infinity)).toBeNull();
  });
  it('正数四舍五入', () => {
    expect(numOrNull('5')).toBe(5);
    expect(numOrNull(2.7)).toBe(3);
  });
});

describe('记录规范化 normalizeRecord', () => {
  it('合法记录原样通过（字段收窄为白名单）', () => {
    const r = normalizeRecord(rec({ words: 279, note: '重读 · 第2遍' }));
    expect(r).not.toBeNull();
    expect(r.date).toBe(daysAgoStr(0));
    expect(r.words).toBe(279);
    expect(r.note).toBe('重读 · 第2遍');
    expect(Object.keys(r).sort()).toEqual([
      'createdAt','date','exam','genre','id','level','minutes','newWords',
      'note','part','set','title','type','words','wrong',
    ]);
  });
  it('缺 id 或缺有效日期的记录被拒绝', () => {
    expect(normalizeRecord(rec({ id: undefined }))).toBeNull();
    expect(normalizeRecord(rec({ date: 'not-a-date' }))).toBeNull();
    expect(normalizeRecord(rec({ date: '' }))).toBeNull();
    expect(normalizeRecord(null)).toBeNull();
  });
  it('数值字段中的脏数据被净化', () => {
    const r = normalizeRecord(rec({ words: 'abc', minutes: -5, wrong: '12' }));
    expect(r.words).toBeNull();
    expect(r.minutes).toBeNull();
    expect(r.wrong).toBe(12);
  });
});

describe('生词规范化 normalizeWord', () => {
  it('合法生词通过；box 越界收敛到 0-4', () => {
    expect(normalizeWord(word()).box).toBe(0);
    expect(normalizeWord(word({ box: 9 })).box).toBe(4);
    expect(normalizeWord(word({ box: -2 })).box).toBe(0);
    expect(normalizeWord(word({ box: 'x' })).box).toBe(0);
  });
  it('缺单词或缺加入时间的生词被拒绝', () => {
    expect(normalizeWord(word({ word: '  ' }))).toBeNull();
    expect(normalizeWord(word({ addedAt: undefined }))).toBeNull();
  });
  it('缺 id 时自动补 id', () => {
    const w = normalizeWord(word({ id: undefined }));
    expect(typeof w.id).toBe('string');
    expect(w.id.length).toBeGreaterThan(0);
  });
});

describe('成绩规范化 normalizeScore', () => {
  it('合法成绩通过', () => {
    const s = normalizeScore({ date: '2026-06-15', total: 520, listen: 180, read: '200', write: null });
    expect(s).toEqual({ date: '2026-06-15', total: 520, listen: 180, read: 200, write: null });
  });
  it('缺日期或总分非正被拒绝', () => {
    expect(normalizeScore({ date: 'bad', total: 500 })).toBeNull();
    expect(normalizeScore({ date: '2026-06-15', total: 0 })).toBeNull();
    expect(normalizeScore({ date: '2026-06-15', total: 'x' })).toBeNull();
  });
});

describe('HTML 转义 esc', () => {
  it('转义标签与引号', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('a"b\'c&d')).toBe('a&quot;b&#39;c&amp;d');
  });
  it('null / undefined 安全', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('批量粘贴解析 parseBulkText', () => {
  const core = () => loadCore({ records: [] });

  it('解析 README 标准样例（序号行、原文精读行忽略）', () => {
    const items = core().parseBulkText(
      '1\n2026 年 6 月 · 第 1 套\nPart III Section A\n完形填空（选词填空）\nC1\n279\n精读\n' +
      '2\n2026 年 6 月 · 第 2 套\nPart II Section B\n长篇阅读（段落匹配）\nB1\n305\n精读');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      exam: '2026年6月', set: '1', part: 'Part III Section A',
      type: '完形填空（选词填空）', level: 'C1', words: 279, ok: true, dup: false,
    });
    expect(items[1]).toMatchObject({ exam: '2026年6月', set: '2', type: '长篇阅读（段落匹配）', words: 305 });
  });

  it('记录前的独立日期行生效', () => {
    const items = core().parseBulkText('2026-06-15\n2026 年 6 月 · 第 1 套\nPart III Section A');
    expect(items[0].date).toBe('2026-06-15');
  });

  it('组间日期行作用于下一组，第一组不受影响', () => {
    const items = core().parseBulkText(
      '2026 年 6 月 · 第 1 套\nPart A\n2026-06-20\n2026 年 6 月 · 第 2 套\nPart B');
    expect(items[0].date).toBeNull();
    expect(items[1].date).toBe('2026-06-20');
  });

  it('最后一组之后的日期行回填到最后一组', () => {
    const items = core().parseBulkText('2026 年 6 月 · 第 1 套\nPart A\n2026-06-20');
    expect(items[0].date).toBe('2026-06-20');
  });

  it('年月行前的纯数字是序号，不当作词数', () => {
    const items = core().parseBulkText('3\n2026 年 6 月 · 第 1 套\nPart A\n精读');
    expect(items[0].words).toBeNull();
    expect(items[0].ok).toBe(true);
  });

  it('斜杠日期行同样识别', () => {
    const items = core().parseBulkText('2026/6/15\n2026 年 6 月 · 第 1 套\nPart A');
    expect(items[0].date).toBe('2026-06-15');
  });

  it('无法识别的组（无年月无 Part）不算有效记录', () => {
    const items = core().parseBulkText('随便写点东西\n再一行');
    expect(items.filter(i => i.ok)).toHaveLength(0);
  });

  it('与已有记录同文章时标记 dup，仍保持 ok', () => {
    const existing = [rec({ exam: '2026年6月', set: '1', part: 'Part III Section A', title: '' })];
    const items = loadCore({ records: existing })
      .parseBulkText('2026 年 6 月 · 第 1 套\nPart III Section A');
    expect(items[0].dup).toBe(true);
    expect(items[0].ok).toBe(true);
  });
});

describe('文章键 articleKey', () => {
  it('按 年月|套|Part|标题 拼接，空值安全', () => {
    expect(articleKey({ exam: '2026年6月', set: '2', part: 'Part A', title: 'T' }))
      .toBe('2026年6月|2|Part A|T');
    expect(articleKey({})).toBe('|||');
  });
});

describe('连续打卡 streak / 坚持天数 activeDays', () => {
  it('今天和昨天都有记录 → 连续 2 天', () => {
    const api = loadCore({ records: [rec({ date: daysAgoStr(0) }), rec({ date: daysAgoStr(1) }), rec({ date: daysAgoStr(1) })] });
    expect(api.streak()).toBe(2);
    expect(api.activeDays()).toBe(2);
  });
  it('今天没读但昨天读了 → 连续 1 天（不打断）', () => {
    const api = loadCore({ records: [rec({ date: daysAgoStr(1) }), rec({ date: daysAgoStr(2) })] });
    expect(api.streak()).toBe(2);
  });
  it('出现断档 → 归零', () => {
    const api = loadCore({ records: [rec({ date: daysAgoStr(3) })] });
    expect(api.streak()).toBe(0);
  });
});

describe('阅读复习调度 reviewInfo（7/14/30 天间隔）', () => {
  it('精读后 8 天 → 第 1 阶段到期', () => {
    const api = loadCore({ records: [rec({ date: daysAgoStr(8) })] });
    const due = api.reviewInfo();
    expect(due).toHaveLength(1);
    expect(due[0].stage).toBe(1);
    expect(due[0].days).toBe(8);
  });
  it('精读后 5 天 → 未到期', () => {
    const api = loadCore({ records: [rec({ date: daysAgoStr(5) })] });
    expect(api.reviewInfo()).toHaveLength(0);
  });
  it('两次打卡间隔按 14 天计', () => {
    const api = loadCore({ records: [rec({ date: daysAgoStr(20), part: 'Part A' }), rec({ date: daysAgoStr(14), part: 'Part A' })] });
    const due = api.reviewInfo();
    expect(due).toHaveLength(1);
    expect(due[0].stage).toBe(2);
    expect(due[0].days).toBe(14);
  });
  it('读满 4 遍视为掌握，不再提醒', () => {
    const api = loadCore({ records: [
      rec({ date: daysAgoStr(90), part: 'Part A' }),
      rec({ date: daysAgoStr(60), part: 'Part A' }),
      rec({ date: daysAgoStr(31), part: 'Part A' }),
      rec({ date: daysAgoStr(40), part: 'Part A' }),
    ]});
    expect(api.reviewInfo()).toHaveLength(0);
  });
});

describe('莱特纳生词调度 isWordDue', () => {
  it('已掌握（box>=4）永不到期', () => {
    expect(isWordDue(word({ box: 4, lastReviewAt: Date.now() - 100 * DAY }))).toBe(false);
  });
  it('从未复习的新词立即到期', () => {
    expect(isWordDue(word({ box: 0, lastReviewAt: null }))).toBe(true);
  });
  it('box=1 间隔 3 天：2 天前复习过未到期，4 天前到期', () => {
    expect(isWordDue(word({ box: 1, lastReviewAt: Date.now() - 2 * DAY }))).toBe(false);
    expect(isWordDue(word({ box: 1, lastReviewAt: Date.now() - 4 * DAY }))).toBe(true);
  });
  it('wordDueCount 只统计未掌握且到期的词', () => {
    const api = loadCore({ words: [
      word({ id: 'a', box: 0, lastReviewAt: null }),
      word({ id: 'b', box: 1, lastReviewAt: Date.now() - 2 * DAY }),
      word({ id: 'c', box: 4, lastReviewAt: null }),
    ]});
    expect(api.wordDueCount()).toBe(1);
  });
});

describe('日期加法 addDays', () => {
  it('跨月进位', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('闰年 2 月 29 日', () => {
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });
  it('跨年进位', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('题型识别 guessType', () => {
  it('常见题面映射到标准题型', () => {
    expect(guessType('仔细阅读（四选一）')).toBe('阅读理解（四选一）');
    expect(guessType('信息匹配题')).toBe('长篇阅读（段落匹配）');
    expect(guessType('选词填空')).toBe('完形填空（选词填空）');
    expect(guessType('汉译英 翻译')).toBe('翻译');
  });
  it('无法识别返回空串', () => {
    expect(guessType('hello world')).toBe('');
  });
});

describe('日期工具', () => {
  it('parseD / fmtD 往返一致', () => {
    expect(fmtD(parseD('2026-10-06'))).toBe('2026-10-06');
  });
});
