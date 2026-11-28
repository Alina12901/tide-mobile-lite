import { extensionTypes } from '/scripts/extensions.js';

const id = decodeURIComponent(new URL('.', import.meta.url).pathname.split('/').filter(Boolean).pop());
const cacheKey = 'tide-update-1.3.18-' + id;
let pending;
export function checkTideUpdate(context, manual) {
    if (pending) return pending;
    if (!manual) {
        try {
            const cached = JSON.parse(context.accountStorage.getItem(cacheKey));
            if (cached && Date.now() - cached.time < 4 * 3600000) return cached;
        } catch { /* No cached result yet. */ }
    }
    pending = probe(context).finally(() => { pending = null; });
    return pending;
}
async function probe(context) {
    const response = await fetch('/api/extensions/version', {
        method: 'POST', headers: context.getRequestHeaders(),
        body: JSON.stringify({extensionName: id, global: extensionTypes['third-party/' + id] === 'global'}),
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('version check failed');
    const result = await response.json();
    if (!result.currentCommitHash || typeof result.isUpToDate !== 'boolean') {
        return {available:false, message:'当前安装缺少版本记录。通过扩展管理用仓库链接安装后，即可接收提醒。'};
    }
    const state = {available: !result.isUpToDate, time: Date.now(), message: result.isUpToDate
        ? '潮汐来信已是当前分支的最新版。' : '潮汐来信有新版，请到酒馆的扩展管理中更新。'};
    context.accountStorage.setItem(cacheKey, JSON.stringify(state));
    return state;
}
