const host=parent.starTideMobile;
const ctx=host.ctx;
let page='home',layer='',lastFocus,recents=[],recentError=false,requestId=0;
const tools={'设定与连接':[['世界书','book'],['API 连接','api'],['预设与提示词','pen'],['高级格式','settings']], '角色与会话':[['角色相册','album'],['原版角色管理','person'],['用户人设','person'],['群聊','chat'],['聊天记录','history']], '工作台':[['Token 用量','box'],['扩展与正则','box'],['主题与背景','palette'],['偏好与快捷指令','settings'],['数据与备份','box']]};
function menuItem(k,name,to=name){return `<button class="tool" data-go="${safe(to)}">${I(k)}<span>${safe(name)}</span><i class="tail">›</i></button>`}
function closePanel(){if(!layer)return;$('#shade').hidden=true;layer='';[...$('#app').children].forEach(node=>node.inert=false);if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true})}
function fail(err){pop('sheet','暂时无法打开','潮汐来信',`<p class="hint">${safe(err.message||'请稍后重试')}</p>`)}
function appearance(){const night=host.appearance();document.documentElement.dataset.mode=night?'night':'day';const btn=$('#lightSwitch');btn.innerHTML=I(night?'sun':'moon');btn.ariaLabel=night?'切换日间模式':'切换夜间模式';btn.setAttribute('aria-pressed',String(night));const bg=host.background();$('#app').style.setProperty('--wall',bg||'none');if(!bg)$('#app').style.removeProperty('--wall');$('#app').classList.toggle('wall',Boolean(bg))}
function noteOf(a){const c=ctx();const group=a.group?c.groups.find(g=>String(g.id)===String(a.group)):null;const ch=c.characters.find(x=>x?.avatar===(group?.members?.[0]??a.avatar));if(!(ch||group))return null;return {avatar:ch?.avatar||'',group:group?.id,file:a.file_id||a.file_name?.replace(/\.jsonl$/,''),name:group?.name||ch.name,count:a.chat_items}}
function image(avatar){return avatar?`<img src="${safe(ctx().getThumbnailUrl('avatar',avatar))}" alt="" loading="lazy">`:''}
function lead(){const c=ctx(),active=c.chatId&&noteOf({avatar:c.characters[c.characterId]?.avatar,group:c.groupId,file_id:c.chatId,chat_items:c.chat.length});return active||recents[0]}
function recentList(){return recents.length?recents.map((r,i)=>`<button class="listing" data-recent="${i}">${image(r.avatar).replace('<img','<img class="thumb"')}<span class="rinfo"><b>${safe(r.name)}</b><small>${safe(r.file||'')}</small></span><span>›</span></button>`).join(''):`<p class="blank">${recentError?'最近会话读取失败':'暂无最近会话'}</p>`}
function homeDraw(){const r=lead();$('#home').innerHTML=`<div class="hero">${art}<div class="heroCopy"><span class="cap">01　/　THE READING ROOM</span><h1>潮汐来信</h1><p>潮声未歇，故事待续。</p></div><small class="folio en">XINGCHUI　 ·　 VOL. 01</small></div><div class="homebody"><div class="sect"><h2>续读</h2><small>LAST CONVERSATION</small></div><button class="resume" data-resume>${image(r?.avatar)}<small class="en">${r?`继续上次聊天　 /　 第 ${r.count??0} 章`:'开启一段聊天'}</small><h2>${safe(r?.name||'选择角色')}</h2><span class="next">${I('next')}</span></button><div class="sect"><h2>人间清欢</h2><small>WORKSPACE</small></div><div class="tiles">${[['book','世界书','条目与世界设定'],['api','API 连接','模型与连接配置']].map(([k,n,l])=>`<button class="tile" data-go="${n}">${I(k)}<b>${n}</b><small>${l}</small></button>`).join('')}${ledgerTile()}</div><div class="sect"><h2>最近会话</h2><button data-go="聊天记录" class="hint">全部 ›</button></div><div class="glass recentShort">${recentList()}</div></div>`}
let available = [], filtered = [], shown = 0, sentinel, flip, generation = 0;
const BATCH = 12;
function releaseCards() {
    generation++;
    sentinel?.disconnect();
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
    if (shown >= filtered.length) sentinel?.disconnect();
}
function filterCards() {
    if (!flip || page !== 'album') return;
    const query = $('#searchBox').value.trim().toLocaleLowerCase();
    filtered = available.filter(({ch}) => ch.name?.toLocaleLowerCase().includes(query));
    shown = 0;
    $('#rm_print_characters_block').replaceChildren();
    $('#result').textContent = `${filtered.length} 位角色`;
    sentinel?.disconnect();
    sentinel = new IntersectionObserver(entries => { if(entries.some(e=>e.isIntersecting)) drawBatch() }, {root:$('#album'),rootMargin:'180px'});
    sentinel.observe($('#result'));
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
async function openAtlas(){
    const origin=page, ticket=++atlasGeneration;
    try {
        const [{mountAtlas},store]=await Promise.all([import('./atlas.js'),host.atlasStore()]);
        if(ticket!==atlasGeneration)return;
        if(!document.querySelector('#tide-atlas-css')){const css=document.createElement('link');css.id='tide-atlas-css';css.rel='stylesheet';css.href='atlas.css';document.head.append(css)}
        closePanel();if(origin==='album')releaseCards();
        atlas=mountAtlas(store,()=>{go(origin);if(origin==='home')$('#home [data-go="世界书"]')?.focus({preventScroll:true})});
        page='atlas';$('#home').hidden=$('#album').hidden=true;
    }catch(err){if(ticket===atlasGeneration)fail(err)}
}
window.suspendTide = () => { requestId++; stopAtlas(); releaseCards(); closePanel() };
function go(k){stopAtlas();closePanel();if(page==='album'&&k!=='album')releaseCards();page=k;$('#album').hidden=k!=='album';$('#home').hidden=k!=='home';$('#brand').innerHTML='<b>星垂</b><small>TAVERN</small>';$('#nav').innerHTML=[['home','首页'],['album','角色'],['chat','聊天']].map(([x,n])=>`<button data-tab="${x}" class="${k===x?'on':''}">${I(x)}${n}</button>`).join('');if(k==='album')gallery();else homeDraw()}
function drawer(){pop('drawer','酒馆目录','INDEX　 /　 XINGCHUI',Object.entries(tools).map(([g,items])=>`<p class="cap group">${g}</p>${items.map(([n,k])=>menuItem(k,n)).join('')}`).join(''))}
function route(n){if(n==='世界书')return openAtlas();if(n==='角色相册')return go('album');if(n==='聊天记录')return pop('sheet',n,'CHAT HISTORY',`<div class="glass">${recentList()}</div>`);if(n==='Token 用量'||n==='token')return showLedger();if(n==='主题与背景')return pop('sheet',n,'APPEARANCE',menuItem('palette','选择酒馆背景','酒馆背景')+menuItem('left','恢复原版酒馆','original'));if(n==='original'){closePanel();host.restore();return}host.drawer(n)}
window.showTideHome=async()=>{appearance();go('home');const seq=++requestId;try{const res=await fetch('/api/chats/recent',{method:'POST',headers:ctx().getRequestHeaders(),body:JSON.stringify({max:16,pinned:[]})});if(!res.ok)throw Error();const data=await res.json();if(seq!==requestId)return;recents=data.map(noteOf).filter(Boolean);recentError=false}catch{if(seq!==requestId)return;recentError=true}if(page==='home')homeDraw()};
async function resumeChat(){const r=lead();if(r)await host.open(r);else go('album')}
document.addEventListener('click',async e=>{try{if(e.target===$('#shade')||e.target.closest('[data-close]'))return closePanel();const btn=e.target.closest('[data-go],[data-tab],[data-recent],[data-resume],.star-enter');if(!btn)return;if(btn.matches('.star-enter'))await host.open({avatar:btn.closest('[data-avatar]').dataset.avatar});else if(btn.hasAttribute('data-resume')||btn.dataset.tab==='chat')await resumeChat();else if(btn.hasAttribute('data-recent'))await host.open(recents[Number(btn.dataset.recent)]);else if(btn.dataset.tab)go(btn.dataset.tab);else route(btn.dataset.go)}catch(err){fail(err)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(layer)closePanel();else if(atlas)atlas.back();else host.hide()}});
icons.moon='M20 14a8.5 8.5 0 0 1-10-11A9 9 0 1 0 20 14z';icons.sun='M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2';$('#left').ariaLabel='全部功能';$('#left').innerHTML=I('menu');$('#left').onclick=drawer;$('#right').ariaLabel='外观选项';$('#right').innerHTML=I('settings');$('#right').onclick=()=>route('主题与背景');$('#lightSwitch').onclick=()=>{host.toggleNight();appearance()};$('#searchLabel').insertAdjacentHTML('afterbegin',I('search'));$('#searchBox').oninput=filterCards;
