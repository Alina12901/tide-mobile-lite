// Mounted only when the world-book tile is opened. No polling or background work.
export function mountAtlas(store, leave, options={}) {
    let book=null, rows=[], row=null, busy=false, stopped=false, ticket=0, query='', limit=40;
    const drafts=new Map(), names=options.names??store.names();
    const pane=document.createElement('section'), footer=document.createElement('footer');
    pane.className='page';pane.id='atlas';footer.className='atrail';$('#nav').before(pane,footer);
    const left=$('#left'), right=$('#right'), oldClick=left.onclick, oldLabel=left.ariaLabel, oldIcon=left.innerHTML;
    left.onclick=back;left.innerHTML=I('left');right.hidden=true;$('#nav').hidden=true;$('#brand').innerHTML='<b>星垂</b><small>ATLAS</small>';
    function stop(){stopped=true;ticket++;pane.remove();footer.remove();left.onclick=oldClick;left.innerHTML=oldIcon;left.ariaLabel=oldLabel;right.hidden=false;$('#nav').hidden=false;drafts.clear()}
    function back(){if(busy)return;if(row){row=null;list()}else if(book!==null){if(drafts.size && !confirm('本书还有未保存的草稿。放弃草稿并返回书架？'))return;if(options.book)return leave();ticket++;book=null;rows=[];drafts.clear();query='';list()}else leave()}
    const fmt=n=>String(n).padStart(2,'0');
    const heading=(tag,title,desc)=>`<header class="atitle"><span class="eyeline">${safe(tag)}</span><h1 tabindex="-1">${safe(title)}</h1><p class="lede">${safe(desc)}</p></header>`;
    function chrome(){left.ariaLabel=row?'返回词条目录':book!==null?'返回书架':'返回上一页';footer.innerHTML=`<span>${safe(options.scope||'人间清欢')}　/　世界书${book===null?'':'　/　'+safe(book)}</span><span>酒馆藏书</span>`;pane.scrollTop=0}
    function status(msg){pane.querySelector('[role=status]').textContent=msg}
    function list(note=''){
        chrome();const shelf=book===null;
        pane.innerHTML=(shelf?heading('03　/　WORLD ATLAS','世界书','收在架上的，是每个故事自己的来处。'):heading('VOLUME　/　ENTRY INDEX',book,`共 ${rows.length} 则词条 · 轻点查看或编辑`))+`<button type="button" class="atlas-full">${shelf?'世界书完整管理':'本书完整编辑'}　›</button><label class="asearch">${I('search')}<input type="search" aria-label="查找" placeholder="${shelf?'按书名查找…':'按名称或关键词查找…'}"></label><div class="${shelf?'ashelf':''}" data-results></div><button class="atlas-more" hidden>继续显示</button><p class="atip" role="status"></p>`;
        const input=pane.querySelector('input'), more=pane.querySelector('.atlas-more');input.value=query;let hits=[];
        function batch(){const box=pane.querySelector('[data-results]'), start=box.children.length;const make=(idx)=>{const r=rows[idx];if(!shelf)return `<button class="arow" data-i="${idx}"><span class="abookmark">${fmt(idx+1)}</span><span class="ainfo"><b>${safe(r.name||'未命名词条')}</b><small>${safe(r.keys||'未设关键词')}</small></span><span class="atag">${drafts.has(r.id)?'有草稿':r.on?'启用':'停用'}</span></button>`;
            return `<button class="avol" data-i="${idx}"><span class="amini v${idx%3}" aria-hidden="true"><small>VOL. ${fmt(idx+1)}</small><svg viewBox="0 0 48 36"><circle cx="34" cy="9" r="4"/><path d="M1 22 Q12 15 23 22 T47 22 M1 27 Q12 20 23 27 T47 27 M1 32 Q12 25 23 32 T47 32"/></svg></span><span class="ainfo"><small class="afolio">WORLD BOOK</small><b>${safe(names[idx])}</b></span>${I('next')}</button>`};box.insertAdjacentHTML('beforeend',hits.slice(start,start+limit).map(make).join(''));more.hidden=box.children.length>=hits.length}
        function filter(){query=input.value;const q=query.trim().toLocaleLowerCase();hits=[];(shelf?names:rows).forEach((x,i)=>{if((shelf?x:x.name+' '+x.keys).toLocaleLowerCase().includes(q))hits.push(i)});pane.querySelector('[data-results]').replaceChildren();batch();status(hits.length?'':q?'没有找到匹配项。':shelf?'书架还是空的。':'这本书还没有词条。')}
        pane.querySelector('.atlas-full').onclick=async()=>{if(drafts.size){status('请先保存草稿，再进入完整编辑。');return}try{await host.drawer('世界书',{book,scope:options.scope||'人间清欢　/　世界书',after:()=>{if(!stopped && book!==null)load(book)}})}catch(e){status(e.message)}};
        input.oninput=filter;more.onclick=batch;filter();if(note)status(note);pane.querySelector('[data-results]').onclick=e=>{const btn=e.target.closest('[data-i]');if(!btn)return;const i=Number(btn.dataset.i);if(shelf)load(names[i]);else edit(rows[i])};pane.querySelector('h1').focus({preventScroll:true});
    }
    async function load(name){book=name;row=null;query='';const t=++ticket;chrome();pane.innerHTML=heading('VOLUME',book,'正在翻开…')+'<p role="status" class="atip"></p>';try{const result=await store.entries(name);if(t!==ticket)return;rows=result;list()}catch(err){if(t!==ticket)return;status(err.message||'读取失败，请返回重试。')}}
    function edit(r){row=r;chrome();const d=drafts.get(r.id)||r;pane.innerHTML=heading('ENTRY　/　'+r.id,r.name||'未命名词条',book+'　·　词条手记')+`<form class="afields"><label>词条名称<input name="name" value="${safe(d.name)}"></label><label>触发关键词<input name="keys" value="${safe(d.keys)}" placeholder="多个关键词用英文逗号分开"></label><label>设定正文<textarea name="body" rows="6">${safe(d.body)}</textarea></label><label class="aswitch"><input type="checkbox" name="enabled" ${d.on?'checked':''}>启用这个词条</label><div class="aactions"><small role="status" class="astatus"></small><button>保存词条</button></div></form>`;
        const form=pane.querySelector('form'),f=form.elements,button=form.querySelector('button');f.namedItem('body').value=d.body;
        const raw=()=>({name:f.namedItem('name').value,keys:f.namedItem('keys').value,body:f.namedItem('body').value,on:f.namedItem('enabled').checked});
        // A browser textarea normalizes CRLF. Leave untouched underlying values as-is.
        const initial=raw();const values=()=>Object.fromEntries(Object.entries(raw()).map(([k,v])=>[k,v===initial[k]?d[k]:v]));function input(){const v=values(),dirty=Object.keys(v).some(k=>v[k]!==r[k]);if(dirty)drafts.set(r.id,v);else drafts.delete(r.id);button.disabled=!dirty;status(dirty?'未保存 · 返回目录保留草稿':'已与酒馆同步')}
        input();form.oninput=input;form.onsubmit=async e=>{e.preventDefault();if(busy)return;const draft=values();busy=true;Array.from(f).forEach(el=>el.disabled=true);status('正在保存…');try{const result=await store.save(book,r.id,r,draft);if(stopped)return;Object.assign(r,result);drafts.delete(r.id);row=null;list('已保存到酒馆世界书。')}catch(err){if(!stopped){Array.from(f).forEach(el=>el.disabled=false);status(err.message||'未能确认保存，请重试。')}}finally{busy=false}};
        pane.querySelector('h1').focus({preventScroll:true});
    }
    if(options.book)load(options.book);else list();return {stop,back};
}
