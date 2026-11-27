const host=parent.starTideMobile;
const ctx=host.ctx;
let page='home',layer='',lastFocus,recents=[],recentError=false,requestId=0;
const tools={'设定与连接':[['世界书','book'],['API 连接','api'],['预设与提示词','pen'],['高级格式','settings']], '角色与会话':[['角色相册','album'],['原版角色管理','person'],['用户人设','person'],['群聊','chat'],['聊天记录','history']], '工作台':[['Token 用量','box'],['扩展与正则','box'],['主题与背景','palette'],['用户设置','box']]};
function menuItem(k,name,to=name){return `<button class="tool" data-go="${safe(to)}">${I(k)}<span>${safe(name)}</span><i class="tail">›</i></button>`}
function closePanel(){if(!layer)return;dismissDeleteNotice();$('#shade').hidden=true;layer='';[...$('#app').children].forEach(node=>node.inert=false);if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true})}
function fail(err){pop('sheet','暂时无法打开','潮汐来信',`<p class="hint">${safe(err.message||'请稍后重试')}</p>`)}
function appearance(){const night=host.appearance();document.documentElement.dataset.mode=night?'night':'day';const btn=$('#lightSwitch');btn.innerHTML=I(night?'sun':'moon');btn.ariaLabel=night?'切换日间模式':'切换夜间模式';btn.setAttribute('aria-pressed',String(night));const bg=host.background();$('#app').style.setProperty('--wall',bg||'none');if(!bg)$('#app').style.removeProperty('--wall');$('#app').classList.toggle('wall',Boolean(bg));
    const hero = host.heroGlobal?.() && host.globalBackground?.();
    $('#app').style.setProperty('--hero-wall', hero || 'none');
    $('#app').classList.toggle('globalHero', Boolean(hero));}
function noteOf(a){const c=ctx();const group=a.group?c.groups.find(g=>String(g.id)===String(a.group)):null;const ch=c.characters.find(x=>x?.avatar===(group?.members?.[0]??a.avatar));if(!(ch||group))return null;return {avatar:ch?.avatar||'',group:group?.id,file:a.file_id||a.file_name?.replace(/\.jsonl$/,''),name:group?.name||ch.name,count:a.chat_items}}
function image(avatar){return avatar?`<img src="${safe(ctx().getThumbnailUrl('avatar',avatar))}" alt="" loading="lazy">`:''}
function lead(){const c=ctx(),active=c.chatId&&noteOf({avatar:c.characters[c.characterId]?.avatar,group:c.groupId,file_id:c.chatId,chat_items:c.chat.length});return active||recents[0]}
function recentList(){return recents.length?recents.map((r,i)=>`<button class="listing" data-recent="${i}">${image(r.avatar).replace('<img','<img class="thumb"')}<span class="rinfo"><b>${safe(r.name)}</b><small>${safe(r.file||'')}</small></span><span>›</span></button>`).join(''):`<p class="blank">${recentError?'最近会话读取失败':'暂无最近会话'}</p>`}
function resumeContent(){const r=lead();return `${image(r?.avatar)}<small class="en">${r?`继续上次聊天　 /　 第 ${r.count??0} 章`:'开启一段聊天'}</small><h2>${safe(r?.name||'选择角色')}</h2><span class="next">${I('next')}</span>`}
function homeDraw(){
    if ($('#home .hero')) {
        $('#home [data-resume]').innerHTML = resumeContent();
        $('#home .recentShort').innerHTML = recentList();
        $('#home .ledgerTile').outerHTML = ledgerTile();
        return;
    }
    $('#home').innerHTML=`<div class="hero">${art}<div class="heroCopy"><span class="cap">01　/　THE READING ROOM</span><h1>潮汐来信</h1><p>潮声未歇，故事待续。</p></div><small class="folio en">XINGCHUI　 ·　 VOL. 01</small></div><div class="homebody"><div class="sect"><h2>续读</h2><small>LAST CONVERSATION</small></div><button class="resume" data-resume>${resumeContent()}</button><div class="sect"><h2>人间清欢</h2><small>WORKSPACE</small></div><div class="tiles">${[['book','世界书','条目与世界设定'],['api','API 连接','模型与连接配置'],['pen','预设与提示词','当前预设与生成参数'],['box','酒馆目录','其余设置与工具']].map(([k,n,l])=>`<button class="tile" data-go="${n}">${I(k)}<b>${n}</b><small>${l}</small></button>`).join('')}${ledgerTile()}</div><div class="sect"><h2>最近会话</h2><button data-go="聊天记录" class="hint">全部 ›</button></div><div class="glass recentShort">${recentList()}</div></div>`}
let available = [], filtered = [], shown = 0, sentinel, flip, generation = 0;
const BATCH = 12;
function releaseCards() {
    generation++;
    sentinel?.disconnect();
    flip?.resetCovers();
    $('#rm_print_characters_block').replaceChildren();
    available = filtered = [];
    shown = 0;
}
function drawBatch() {
    if (!flip || page !== 'album') return;
    const cards = filtered.slice(shown, shown + BATCH).map(({ch,i}) => {
        const el = document.createElement('div');
        el.className = 'character_select';
        el.dataset.chid = i;
        el.dataset.avatar = ch.avatar;
        return el;
    });
    flip.enhanceBatch(cards);
    $('#rm_print_characters_block').append(...cards);
    shown += cards.length;
    sentinel?.disconnect();
    if (shown < filtered.length) sentinel?.observe($('#result'));
}
function filterCards() {
    if (!flip || page !== 'album') return;
    const query = $('#searchBox').value.trim().toLocaleLowerCase();
    filtered = available.filter(({ch}) => ch.name?.toLocaleLowerCase().includes(query));
    shown = 0;
    flip?.resetCovers();
    $('#rm_print_characters_block').replaceChildren();
    $('#result').textContent = `${filtered.length} 位角色`;
    sentinel?.disconnect();
    sentinel = new IntersectionObserver(entries => { if(entries.some(e=>e.isIntersecting)) drawBatch() }, {root:$('#album'),rootMargin:'180px'});
    drawBatch();
}
async function gallery() {
    releaseCards();
    const ticket = generation;
    try { flip = await import('./flip.js'); } catch { return fail(Error('相册暂时无法加载，请重试')); }
    if (ticket !== generation || page !== 'album') return;
    available = ctx().characters.map((ch,i)=>({ch,i})).filter(x=>x.ch?.avatar);
    filterCards();
}
let atlas, atlasGeneration=0;
function stopAtlas(){atlasGeneration++;atlas?.stop();atlas=null}
async function openAtlas(options={}){
    const origin=page, ticket=++atlasGeneration;
    try {
        const [{mountAtlas},store]=await Promise.all([import('./atlas.js'),host.atlasStore()]);
        if(ticket!==atlasGeneration)return;
        if(!document.querySelector('#tide-atlas-css')){const css=document.createElement('link');css.id='tide-atlas-css';css.rel='stylesheet';css.href='atlas.css';document.head.append(css)}
        closePanel();
        atlas=mountAtlas(store,()=>{if(origin==='album'){stopAtlas();page='album';$('#album').hidden=false;$('#brand').innerHTML='<b>星垂</b><small>TAVERN</small>';options.focus?.focus({preventScroll:true})}else if(origin==='desk'){stopAtlas();window.showChatDesk()}else{go(origin);$('#home [data-go="世界书"]')?.focus({preventScroll:true})}},options);
        if($('#desk'))$('#desk').hidden=true;page='atlas';$('#home').hidden=$('#album').hidden=true;
    }catch(err){if(ticket===atlasGeneration)fail(err)}
}
window.suspendTide = () => { requestId++; resetDesk();stopAtlas(); releaseCards(); closePanel() };
let chatOrigin = 'home';
function setReading(active) {
    $('#app').classList.toggle('reading', active);
    host.reading?.(active);
}
function returnFromChat() {
    if (chatOrigin === 'album') go('album');
    else window.showTideHome();
}
window.refreshChatTitle = () => {
    if (page !== 'chat') return;
    const c = ctx();
    const group = c.groups?.find(g => c.groupId != null && String(g.id) === String(c.groupId));
    $('#brand').innerHTML = `<b>${safe(group?.name || c.characters?.[c.characterId]?.name || '当前会话')}</b><small>DIALOGUE</small>`;
};
window.showTideChat = () => {
    if (page === 'home' || page === 'album') chatOrigin = page;
    requestId++;
    closePanel();
    stopAtlas();
    resetDesk();
    if (page === 'album') releaseCards();
    page = 'chat';
    $('#home').hidden = $('#album').hidden = $('#nav').hidden = true;
    $('#left').ariaLabel = '返回' + (chatOrigin === 'album' ? '角色相册' : '首页');
    $('#left').innerHTML = I('left');
    $('#left').onclick = returnFromChat;
    $('#right').ariaLabel = '角色资料与会话工具';
    $('#right').innerHTML = I('person');
    $('#right').onclick = window.showChatDesk;
    window.refreshChatTitle();
    appearance();
    setReading(true);
};
function go(k){setReading(false);resetDesk();stopAtlas();closePanel();if(page==='album'&&k!=='album')releaseCards();page=k;$('#album').hidden=k!=='album';$('#home').hidden=k!=='home';$('#brand').innerHTML='<b>星垂</b><small>TAVERN</small>';$('#nav').innerHTML=[['home','首页'],['album','角色'],['chat','聊天']].map(([x,n])=>`<button data-tab="${x}" class="${k===x?'on':''}">${I(x)}${n}</button>`).join('');if(k==='album')gallery();else homeDraw()}
function drawer(){pop('drawer','酒馆目录','INDEX　 /　 XINGCHUI',Object.entries(tools).map(([g,items])=>`<p class="cap group">${g}</p>${items.map(([n,k])=>menuItem(k,n)).join('')}`).join(''))}
let versionState = '';
function themePanel() {
    const global = host.heroGlobal?.();
    pop('sheet','主题与背景','APPEARANCE', '<h3>首页题图</h3>' +
        menuItem('moon', (global ? '' : '✓ ') + '潮汐月景','hero-default') +
        menuItem('palette', (global ? '✓ ' : '') + '跟随全局背景','hero-global') +
        (global && !host.globalBackground?.() ? '<p class="hint">当前全局背景为空。点「选择酒馆背景」选一张图。</p>' : '') +
        menuItem('palette','选择酒馆背景','酒馆背景') + menuItem('history','检查潮汐更新','检查更新') +
        '<p class="hint" role="status" data-update-status></p>' + menuItem('left','恢复原版酒馆','original') + `<p class="hint">${safe(host.reopenHint || '')}</p>`);
    $('[data-update-status]').textContent = versionState;
}
async function refreshUpdate(manual) {
    if (!host.updateState) return;
    const status = () => $('[data-update-status]');
    if (manual && status()) status().textContent = '正在检查…';
    try {
        const state = await host.updateState(manual);
        versionState = state.message;
        $('#right').toggleAttribute('data-update', state.available);
    } catch { versionState = '暂时无法连接更新服务，可以稍后再试。'; }
    if (status()) status().textContent = versionState;
}
window.addEventListener('load', () => setTimeout(() => refreshUpdate(false), 1600), {once:true});
function route(n){if(n==='酒馆目录')return drawer();if(n==='世界书')return openAtlas();if(n==='角色相册')return go('album');if(n==='聊天记录')return pop('sheet',n,'CHAT HISTORY',`<div class="glass">${recentList()}</div>`);if(n==='Token 用量'||n==='token')return showLedger();if(n==='主题与背景')return themePanel();if(n==='检查更新')return refreshUpdate(true);if(n==='hero-default'||n==='hero-global'){host.heroGlobal(n==='hero-global');appearance();return themePanel()}if(n==='original'){closePanel();host.restore();return}return host.drawer(n,{scope:page==='desk'?'当前会话　/　手边工具':'人间清欢　/　WORKSPACE'})}
window.showTideHome=async()=>{appearance();go('home');const seq=++requestId;try{const res=await fetch('/api/chats/recent',{method:'POST',headers:ctx().getRequestHeaders(),body:JSON.stringify({max:16,pinned:[]})});if(!res.ok)throw Error();const data=await res.json();if(seq!==requestId)return;recents=data.map(noteOf).filter(Boolean);recentError=false}catch{if(seq!==requestId)return;recentError=true}if(page==='home'){
    $('#home [data-resume]').innerHTML=resumeContent();
    $('#home .recentShort').innerHTML=recentList();
}};
async function resumeChat(){const r=lead();if(r)await host.open(r);else go('album')}
document.addEventListener('click',async e=>{try{if(e.target===$('#shade')||e.target.closest('[data-close]'))return closePanel();const btn=e.target.closest('[data-go],[data-tab],[data-recent],[data-resume],.star-enter');if(!btn)return;if(btn.matches('.star-enter'))await host.open({avatar:btn.closest('[data-avatar]').dataset.avatar});else if(btn.hasAttribute('data-resume')||btn.dataset.tab==='chat')await resumeChat();else if(btn.hasAttribute('data-recent'))await host.open(recents[Number(btn.dataset.recent)]);else if(btn.dataset.tab)go(btn.dataset.tab);else await route(btn.dataset.go)}catch(err){fail(err)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(layer)closePanel();else if(atlas)atlas.back();else if(page==='desk')window.showTideChat();else if(page==='chat')returnFromChat();else if(page==='album')go('home')}});
icons.moon='M20 14a8.5 8.5 0 0 1-10-11A9 9 0 1 0 20 14z';icons.sun='M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2';$('#left').ariaLabel='全部功能';$('#left').innerHTML=I('menu');$('#left').onclick=drawer;$('#right').ariaLabel='外观选项';$('#right').innerHTML=I('settings');$('#right').onclick=()=>route('主题与背景');$('#lightSwitch').onclick=()=>{host.toggleNight();appearance()};$('#searchLabel').insertAdjacentHTML('afterbegin',I('search'));$('#searchBox').oninput=filterCards;

window.refreshTideTheme=appearance;
let deskGeneration=0;
function resetDesk(){deskGeneration++;$('#right').ariaLabel='外观选项';$('#right').innerHTML=I('settings');$('#right').onclick=()=>route('主题与背景');const desk=$('#desk');if(desk)desk.hidden=true;$('#right').hidden=false;$('#nav').hidden=false;$('#left').onclick=drawer;$('#left').ariaLabel='全部功能';$('#left').innerHTML=I('menu')}
window.showChatDesk=async()=>{
    setReading(false);
    closePanel();stopAtlas();const ticket=++deskGeneration;page='desk';appearance();$('#album').hidden=$('#home').hidden=$('#nav').hidden=$('#right').hidden=true;
    let desk=$('#desk');if(!desk){desk=document.createElement('section');desk.id='desk';desk.className='page pad';$('#nav').before(desk)}desk.hidden=false;$('#brand').innerHTML='<b>星垂</b><small>DIALOGUE</small>';$('#left').innerHTML=I('left');$('#left').ariaLabel='返回当前聊天';$('#left').onclick=window.showTideChat;
    const c=ctx(),group=c.groups?.find(g=>c.groupId!=null&&String(g.id)===String(c.groupId)),ch=c.characters?.[c.characterId],members=group?(group.members||[]).map(a=>c.characters.find(v=>v?.avatar===a)).filter(Boolean):ch?[ch]:[];
    const title=group?.name||ch?.name||'当前会话';const section=(k,t)=>`<div class="sect"><h2>${t}</h2><small>${k}</small></div>`;
    desk.innerHTML=`<span class="cap">FIELD NOTES　 /　 当前会话</span><h1 class="title">${safe(title)}</h1><div data-profiles></div>${section('LINKED BOOKS','关联世界书')}<div class="glass" data-desk-books><p class="blank">正在整理书目…</p></div>${section('WORKSPACE','手边工具')}<div class="glass">${menuItem('api','API 连接')}${menuItem('pen','预设与提示词')}${menuItem('box','Token 用量')}${menuItem('box','酒馆目录')}</div><p class="hint" style="margin-top:14px">连接、预设与用量为全局设置。</p>`;
    desk.scrollTop = 0;
    const inflight = new Map();
    async function resolveCharacter(member) {
        const list = ctx().characters;
        const index = list.findIndex(item => item?.avatar === member.avatar);
        const current = list[index];
        if (!current) throw Error('找不到角色');
        if (!current.shallow && (current.data || current.first_mes || current.description)) return current;
        if (!inflight.has(member.avatar)) {
            const load = (async () => {
                await ctx().unshallowCharacter(String(index));
                const full = ctx().characters.find(item => item?.avatar === member.avatar);
                if (!full || full.shallow) throw Error('暂时无法读取角色');
                return full;
            })();
            inflight.set(member.avatar, load);
        }
        try { return await inflight.get(member.avatar); }
        finally { inflight.delete(member.avatar); }
    }
    const profiles = desk.querySelector('[data-profiles]');
    try {
        const { mountProfile } = await import('./profile.js');
        if (ticket !== deskGeneration || page !== 'desk') return;
        for (const member of members) mountProfile(profiles, member, resolveCharacter);
    } catch { profiles.textContent = '暂时无法打开角色设定。'; }
    try {
        const bindings = [];
        for (const member of members) {
            if (ticket !== deskGeneration || page !== 'desk') return;
            bindings.push(await host.linkedBooks(await resolveCharacter(member)));
        }
        if (ticket !== deskGeneration || page !== 'desk') return;
        const names=[...new Set([c.chatMetadata?.world_info,...bindings.flat()].filter(Boolean))];const box=desk.querySelector('[data-desk-books]');box.innerHTML=names.length?names.map((name,i)=>`<button class="tool" data-bound="${i}">${I('book')}<span>${safe(name)}</span><i class="tail">›</i></button>`).join(''):'<p class="blank">这个会话和角色没有关联世界书。</p>';box.onclick=e=>{const t=e.target.closest('[data-bound]');if(t)openAtlas({book:names[+t.dataset.bound],scope:title})};
    }catch{if(ticket===deskGeneration)desk.querySelector('[data-desk-books]').textContent='暂时无法读取关联书目。'}
};
document.addEventListener('click',e=>{const link=e.target.closest('.tide-book-link');if(link)openAtlas({book:link.dataset.book,scope:link.closest('.character_select')?.querySelector('.star-back-name')?.textContent||'角色相册',focus:link})});
