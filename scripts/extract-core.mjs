// 从 index.html 提取 __CORE_BEGIN__ ~ __CORE_END__ 之间的纯函数区块，供单元测试使用。
// 应用本体仍是零依赖单文件；本脚本与 tests/ 仅在开发与 CI 中运行。
//
// 模块用法：  import { extractCore, loadCore } from './extract-core.mjs'
// 命令行：    node scripts/extract-core.mjs   （提取 + 语法检查）
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function extractCore(html){
  const src = html ?? readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const begin = src.indexOf('/* __CORE_BEGIN__');
  const end = src.indexOf('/* __CORE_END__');
  if (begin < 0 || end < 0 || end < begin){
    throw new Error('index.html 中找不到 __CORE_BEGIN__ / __CORE_END__ 标记');
  }
  let code = src.slice(begin, end);
  code = code.slice(code.indexOf('*/') + 2);   // 去掉 BEGIN 注释行本身
  return code;
}

/* 加载 CORE 区块为可调用 API。
   区块内的函数通过闭包参数访问 records / words，
   测试可以传入自己的数据隔离运行。 */
export function loadCore({ records = [], words = [] } = {}){
  const code = extractCore();
  const factory = new Function('records', 'words', code +
    '\n;return { esc, pad2, fmtD, todayStr, parseD, dateCN, dateCNFull, wdCN,' +
    ' normDateStr, numOrNull, normalizeRecord, normalizeWord, normalizeScore, genId,' +
    ' sortedRecords, recordsOf, uniqueArticleCount, articleKey, totalWords, streak, activeDays,' +
    ' addDays, reviewInfo, isWordDue, wordDueCount, ymKey, blankItem, guessType, parseBulkText };');
  return factory(records, words);
}

const invokedDirectly = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly){
  try{
    const code = extractCore();
    new Function(code);   // 仅编译不执行
    console.log('CORE 提取成功：' + code.length + ' 字符，语法检查通过');
  }catch(e){
    console.error('CORE 提取失败：' + e.message);
    process.exit(1);
  }
}
