// Runs in the host realm so the native editor, cache and events stay in sync.
import * as wi from '/scripts/world-info.js';
const ctx = () => SillyTavern.getContext();
async function post(action, payload) {
    const response = await fetch('/api/worldinfo/' + action, {method:'POST', headers:ctx().getRequestHeaders(), body:JSON.stringify(payload), cache:'no-store'});
    if (!response.ok) throw Error(`酒馆请求失败（${response.status}），请稍后重试。`);
    return response.json();
}
export function names() {
    if (!Array.isArray(wi.world_names)) throw Error('酒馆书目还未就绪，请返回后重试。');
    return [...wi.world_names];
}
async function read(name) {
    if (!wi.world_names?.includes(name)) throw Error('这本书已不在书架上，请返回后重新打开。');
    const data = await post('get', {name});
    if (!data?.entries || typeof data.entries !== 'object') throw Error('无法读取这本世界书。');
    return data;
}
const fields = row => ({name:row.comment ?? '', keys:(row.key || []).join(', '), body:row.content ?? '', on:!row.disable});
export async function entries(name) {
    return Object.entries((await read(name)).entries).filter(([,v])=>v && typeof v==='object').map(([id,v])=>({id, ...fields(v)}));
}
export async function save(name, id, base, draft) {
    // Re-read, then patch only fields the reader actually changed.
    const data = await read(name);
    if (!Object.hasOwn(data.entries,id)) throw Error('词条已被移除，未写入任何更改。');
    const row=data.entries[id], now=fields(row);
    const changes=Object.keys(now).filter(k=>draft[k]!==base[k]);
    if(changes.some(k=>now[k]!==base[k] && now[k]!==draft[k])) throw Error('这个字段已在别处修改。请先复制草稿，再重新打开这本书核对。');
    for(const k of changes){
        const [field,original,value]=k==='keys'?['key','keys',wi.splitKeywordsAndRegexes(draft.keys)]:k==='on'?['disable','enabled',!draft.on]:k==='name'?['comment','comment',draft.name]:['content','content',draft.body];
        row[field]=value;
        wi.setWIOriginalDataValue(data,row.uid,original,k==='on'?draft.on:value);
    }
    if(changes.length){
        const ack=await post('edit',{name,data});
        if(ack?.ok!==true) throw Error('酒馆没有确认保存，请检查连接。');
        wi.worldInfoCache.set(name,data);
        const c=ctx();
        try {await c.eventSource.emit(c.eventTypes.WORLDINFO_UPDATED,name,data); wi.reloadEditor(name)} catch(err){console.warn('[潮汐来信] 已保存，原生面板未刷新',err)}
    }
    return {id,...fields(row)};
}
