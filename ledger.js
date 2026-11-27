const ranges=['今日','近 7 天','累计'];let range=0, billing=false, editing=null;
const fmt=n=>Number(n||0).toLocaleString('zh-CN');
const usage=()=>ctx().extensionSettings.st_simple_usage;
function dayKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function lastDays(n){return Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-n+i+1);return dayKey(d)})}
function measure(period){const s=usage()||{},days=s.days||{},models=s.models||{},keys=Object.keys(models);const dates=period===2?Object.keys(days).sort():lastDays(period===0?1:7);const rows=new Map(keys.map(k=>[k,{record:models[k],input:0,output:0,count:0}]));const groups=dates.map(date=>{let input=0,output=0;for(const [key,v] of Object.entries(days[date]||{})){input+=v.pin||0;output+=v.pout||0;const row=rows.get(key);if(row&&period!==2){row.input+=v.pin||0;row.output+=v.pout||0;row.count+=v.calls||0}}return {label:date.slice(5),input,output}});if(period===2)for(const row of rows.values()){const r=row.record;Object.assign(row,{input:r.pin||0,output:r.pout||0,count:r.calls||0})}let input=0,output=0,count=0,cost=0,unpriced=0;for(const row of rows.values()){input+=row.input;output+=row.output;count+=row.count;const r=row.record;row.priced=r.tidePriced===true||(r.mode==='call'?r.perCall>0:r.perIn>0||r.perOut>0);row.cost=r.mode==='call'?row.count*(r.perCall||0):(row.input*(r.perIn||0)+row.output*(r.perOut||0))/1e6;if(row.priced)cost+=row.cost;else if(row.count)unpriced++}return {rows,groups,input,output,total:input+output,count,cost,unpriced}}
const money=n=>safe(usage()?.currency||'¥')+Number(n).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:6});
function ledgerTile(){
    const { days = {}, models = {} } = usage() || {};
    let today = 0;
    const week = lastDays(7);
    const groups = week.map(date => {
        let input = 0, output = 0;
        for (const [key, entry] of Object.entries(days[date] || {})) {
            input += entry.pin || 0;
            output += entry.pout || 0;
            if (date === week[6] && Object.hasOwn(models, key)) today += (entry.pin || 0) + (entry.pout || 0);
        }
        return {label: date.slice(5), input, output};
    });
    return `<button class="tile ledgerTile" data-go="token"><span><small>TOKEN JOURNAL</small><b>Token 用量</b></span><span class="tileSum"><strong>${fmt(today)}</strong><small>今日 Token</small></span>${graph(groups,true)}<i class="tail">›</i></button>`}
function billingForm(idx,r){return `<form class="rateForm" data-key="${safe(idx)}"><label>计费方式<select name="mode"><option value="token">按量</option><option value="call" ${r.mode==='call'?'selected':''}>按次</option></select></label>${[['perIn','输入 / 百万 Token'],['perOut','输出 / 百万 Token'],['perCall','每次请求']].map(([k,label])=>{const on=(k==='perCall')===(r.mode==='call');return `<label ${on?'':'hidden'}>${label}（${safe(usage()?.currency||'¥')}）<input name="${k}" type="number" step="any" min="0" max="1000000000" value="${Number(r[k])||0}" ${on?'required':'disabled'}></label>`}).join('')}<div class="rateActions"><button data-cancel-rate type="button">取消</button><button>保存单价</button></div></form>`}
let lastDeleted = null;

function deleteLedgerRow(key) {
    const store = usage();
    if (!store?.models || !Object.hasOwn(store.models, key)) return;
    const removed = { key, record: store.models[key], days: new Map() };
    for (const [date, bucket] of Object.entries(store.days || {})) {
        if (!Object.hasOwn(bucket, key)) continue;
        removed.days.set(date, bucket[key]);
        delete bucket[key];
        if (!Object.keys(bucket).length) delete store.days[date];
    }
    delete store.models[key];
    lastDeleted = removed;
    saveLedgerChange();
}

function restoreLedgerRow() {
    const store = usage();
    if (!lastDeleted || !store?.models) return;
    const { key, record, days } = lastDeleted;
    // New calls can arrive between deletion and undo. Keep their counts too.
    function restore(bucket, previous) {
        const current = bucket[key];
        const merged = { ...previous };
        if (current?.tidePriced) Object.assign(merged, current);
        for (const field of ['calls', 'pin', 'pout']) {
            merged[field] = (previous[field] || 0) + (current?.[field] || 0);
        }
        bucket[key] = merged;
    }
    restore(store.models, record);
    for (const [date, previous] of days) restore(store.days[date] ||= {}, previous);
    lastDeleted = null;
    saveLedgerChange();
}

function saveLedgerChange() {
    ctx().saveSettingsDebounced();
    editing = null;
    ledgerRefresh();
    const tile = $('#home .ledgerTile');
    if (tile) tile.outerHTML = ledgerTile();
}

function deleteButton(key, record) {
    const label = safe(`删除 ${record.api || ''} ${record.model || key} 的全部用量记录`);
    return `<button type="button" class="ledgerDelete" data-delete-usage="${safe(key)}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16m-11 0V4h6v3m-9 0 1 13h10l1-13M10 10v7m4-7v7"/></svg></button>`;
}

document.addEventListener('click', event => {
    const button = event.target.closest('#ledgerBody [data-delete-usage], #ledgerBody [data-undo-usage]');
    if (!button) return;
    if (button.hasAttribute('data-undo-usage')) restoreLedgerRow();
    else deleteLedgerRow(button.dataset.deleteUsage);
});
function ledgerView(){const d=measure(range);const total=`<section class="ledgerTotal"><small>${ranges[range]} · ${billing?'已定价小计':'Token 用量'}</small><div><strong>${billing?money(d.cost):fmt(d.total)}</strong></div><small>${fmt(d.count)} 次请求<span>${d.unpriced?`${d.unpriced} 项待定价`:'已记录用量'}</span></small></section>`;let body;if(billing){body=Array.from(d.rows,([key,row])=>`<section class="glass ledgerBox rateRow"><div class="headrow"><small class="apiBadge">${safe(row.record.api||'接口')}</small>${deleteButton(key,row.record)}</div><div class="headrow"><h3>${safe(row.record.model||key)}</h3><b>${row.priced?money(row.cost):'待定价'}</b></div><p class="billUsage">${row.count} 次 · 输入 ${fmt(row.input)} · 输出 ${fmt(row.output)}</p>${editing===key?billingForm(key,row.record):`<button class="rateEdit" data-rate="${safe(key)}">${row.priced?'修改单价':'填写价格'}　›</button>`}</section>`).join('')||'<p class="blank">收到模型回复后，这里会显示对应接口。</p>'}else{const g=d.groups;body=`<div class="ledgerPair"><div class="glass"><small>输入 Token</small><b>${fmt(d.input)}</b></div><div class="glass"><small>输出 Token</small><b>${fmt(d.output)}</b></div></div><section class="glass ledgerBox"><div class="headrow"><h3>用量走势</h3><small>按日汇总</small></div>${g.length>1?`<div class="ledgerLegend">━ 输入　 ┄ 输出</div>${graph(g)}<div class="headrow ledgerAxis"><span>${g[0].label}</span><span>${g.at(-1).label}</span></div>`:`<div class="ledgerTrack"><i style="width:${d.total?100*d.input/d.total:0}%"></i></div><small>今日输入占比 ${d.total?Math.round(100*d.input/d.total):0}%</small>`}</section><button class="billLink" data-billing="1"><span><small>预估费用</small><b>${money(d.cost)}</b></span><span>接口账本 ›</span></button>`}return `<div class="billNav">${['用量走势','接口账本'].map((x,i)=>`<button data-billing="${i}" aria-pressed="${Boolean(i)===billing}">${x}</button>`).join('')}</div><div class="ledgerTabs">${ranges.map((s,i)=>`<button data-period="${i}" aria-pressed="${range===i}">${s}</button>`).join('')}</div>${total}${billing?'<p class="hint">垃圾桶会删除该接口与模型的全部历史用量和单价。</p>':''}${body}${billing && lastDeleted?`<div class="ledgerUndo" role="status"><span>已删除 ${safe(lastDeleted.record.model || lastDeleted.key)}</span><button type="button" data-undo-usage>撤销</button></div>`:''}${billing?'':breakdown(d)}<p class="toolsnote">用量来自「用量记账」的本地记录。费用按当前接口与模型单价估算。</p>`}
function ledgerRefresh(){if($('#ledgerBody'))$('#ledgerBody').innerHTML=ledgerView()}
function showLedger(){billing=false;editing=null;pop('sheet','Token 用量','TOKEN JOURNAL',`<div id="ledgerBody">${ledgerView()}</div>`)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-period],[data-billing],[data-rate],[data-cancel-rate]');if(!b)return;editing=b.dataset.rate??null;if(b.dataset.period!==undefined)range=Number(b.dataset.period);if(b.dataset.billing!==undefined)billing=Boolean(+b.dataset.billing);ledgerRefresh()});document.addEventListener('change',e=>{if(!e.target.matches('.rateForm select'))return;for(const input of e.target.form.querySelectorAll('input')){const on=(input.name==='perCall')===(e.target.value==='call');input.parentElement.hidden=!on;input.disabled=!on;input.required=on}});document.addEventListener('submit',e=>{const f=e.target.closest('.rateForm');if(!f)return;e.preventDefault();const record=usage()?.models?.[f.dataset.key];if(!record||!f.reportValidity())return;const patch={mode:f.elements.mode.value,tidePriced:true};for(const el of f.querySelectorAll('input:enabled')){const value=el.valueAsNumber;if(!Number.isFinite(value)||value<0)return;patch[el.name]=value}Object.assign(record,patch);ctx().saveSettingsDebounced();editing=null;ledgerRefresh()});
function breakdown(data) {
    const share = data.total ? Math.round(data.input * 100 / data.total) : 0;
    const totals = new Map();
    for (const [key, row] of data.rows) {
        if (!row.count && !row.input && !row.output) continue;
        const name = row.record.model || key;
        totals.set(name, (totals.get(name) || 0) + row.input + row.output);
    }
    const ranking = [...totals].sort((a,b) => b[1] - a[1]);
    const days = data.groups.slice().reverse().map(day => `<p class="ledgerEntry"><span>${day.label}</span><span>入 ${fmt(day.input)} · 出 ${fmt(day.output)}</span></p>`).join('');
    return `<section class="glass ledgerBox"><h3>用量构成</h3><div class="ledgerTrack"><i style="width:${share}%"></i></div><div class="headrow"><small>输入 ${share}%</small><small>输出 ${data.total?100-share:0}%</small></div><details><summary>查看逐日明细</summary>${days||'<p>暂无流水</p>'}</details></section><section class="glass ledgerBox"><h3>模型用量</h3>${ranking.map(([name,value])=>`<p class="ledgerEntry"><span>${safe(name)}</span><b>${fmt(value)}</b></p>`).join('')||'<small>本期暂无记录</small>'}</section>`;
}
parent.starTideMobile.ready();
