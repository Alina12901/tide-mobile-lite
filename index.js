import { background_settings } from '/scripts/backgrounds.js';
/*! 星垂 · 潮汐来信 | Alina12901/tide-mobile-lite | 版本记录见 provenance.json */
const ctx = () => SillyTavern.getContext();
const mobile = matchMedia('(max-width:800px), (pointer:coarse) and (max-height:800px) and (orientation:landscape)');
const root = document.documentElement;
const pref = () => ctx().accountStorage;
const showLauncher = () => pref().getItem('tide-mobile-launcher') !== '0';
const reopenHint = '如果想再打开，就在魔术棒里或是拓展这打开，浮在页面上的按钮可以选择存在或关闭。';
const original = () => pref().getItem('tide-mobile-original') === '1';
// The native splash can close before the shell has painted. Keep the same
// artwork underneath it so the handoff also works on slower devices.
let startupCover, nativeCover, startupDialog, recoveryTimer;
function finishStartup() {
    clearTimeout(recoveryTimer);
    startupCover?.remove();
    nativeCover?.remove();
    startupDialog?.classList.remove('tide-startup-dialog');
    startupCover = nativeCover = startupDialog = null;
}
function startLetter() {
    const cover = document.createElement('div');
    cover.className = 'tide-startup-cover';
    const art = new Image();
    art.alt = '';
    art.fetchPriority = 'high';
    art.src = new URL('./letter.webp', import.meta.url).href;
    const caption = document.createElement('span');
    caption.className = 'tide-letter-caption';
    caption.setAttribute('role', 'status');
    caption.textContent = '载入中…';
    cover.append(art, caption);
    startupCover = cover;
    document.body.append(cover);
    startupDialog = document.querySelector('#loader')?.closest('dialog');
    if (startupDialog) {
        startupDialog.classList.add('tide-startup-dialog');
        nativeCover = cover.cloneNode(true);
        startupDialog.append(nativeCover);
    }
    // Only offer recovery if the host or shell is taking unusually long.
    recoveryTimer = setTimeout(() => {
        for (const layer of [startupCover, nativeCover]) {
            if (!layer?.isConnected) continue;
            const exit = document.createElement('button');
            exit.type = 'button';
            exit.textContent = '返回原版酒馆';
            exit.onclick = () => window.starTideMobile.restore();
            layer.append(exit);
        }
    }, 12000);
}
if (mobile.matches && !original()) startLetter();
const frame = document.createElement('iframe');
frame.id = 'tide-mobile-shell';
frame.title = '潮汐来信';
frame.hidden = true;
const launcher = document.createElement('button');
launcher.id = 'tide-mobile-launch';
launcher.type = 'button';
launcher.textContent = '✦';
launcher.title = launcher.ariaLabel = '打开潮汐来信首页';
const dock = document.createElement('div');
dock.id = 'tide-mobile-dock';
dock.hidden = true;
dock.append(launcher);
let toolModule;
let portraitViewer;
document.addEventListener('click', event => {
    if (!root.hasAttribute('data-tide-reading')) return;
    const avatar = event.target.closest?.('#chat .mes .avatar');
    const source = avatar?.querySelector('img')?.currentSrc;
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    const url = new URL(source);
    const file = url.searchParams.get('file');
    let full = source;
    if (url.origin === location.origin && file && url.pathname.endsWith('/thumbnail')) {
        const type = url.searchParams.get('type');
        if (type === 'avatar') full = `/characters/${encodeURIComponent(file)}`;
        if (type === 'persona') full = `/User%20Avatars/${encodeURIComponent(file)}`;
    }
    const viewer = document.createElement('dialog');
    viewer.id = 'tide-portrait-viewer';
    viewer.setAttribute('aria-label', '查看完整头像');
    const close = document.createElement('button');
    close.type = 'button';
    close.ariaLabel = '关闭图片';
    const image = new Image();
    image.alt = avatar.closest('.mes').getAttribute('ch_name') || '人物头像';
    if (full !== source) image.addEventListener('error', () => { image.src = source; }, {once:true});
    image.src = full;
    close.append(image);
    viewer.append(close);
    viewer.onclick = () => viewer.close();
    viewer.onclose = () => { viewer.remove(); if (portraitViewer === viewer) portraitViewer = null; };
    document.body.append(viewer);
    portraitViewer = viewer;
    viewer.showModal();
}, true);
// Keep the compact reader independent of the native auto-expand preference.
function compactReasoning(chat) {
    const selector = 'details.mes_reasoning_details';
    const userChoice = new WeakMap();
    const autoOpened = new WeakSet();
    function fold(block) {
        if (!block.open || userChoice.get(block) === true) return;
        if (!userChoice.has(block)) autoOpened.add(block);
        block.open = false;
    }
    function remember(event) {
        const header = event.target.closest('.mes_reasoning_header');
        const block = header?.closest(selector);
        if (block?.querySelector('.mes_reasoning:not(:empty)')) userChoice.set(block, !block.open);
    }
    function onToggle(event) {
        if (event.target.matches(selector)) fold(event.target);
    }
    // Only inspect inserted message rows, never the changing text of a stream.
    const rows = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
            if (node.matches?.('.mes')) node.querySelectorAll(selector + '[open]').forEach(fold);
        }
    });
    rows.observe(chat, { childList: true });
    chat.addEventListener('click', remember, true);
    chat.addEventListener('toggle', onToggle, true);
    chat.querySelectorAll(selector + '[open]').forEach(fold);
    return () => {
        rows.disconnect();
        chat.removeEventListener('click', remember, true);
        chat.removeEventListener('toggle', onToggle, true);
        chat.querySelectorAll(selector).forEach(block => {
            if (autoOpened.has(block) && !userChoice.has(block)) block.open = true;
        });
    };
}
let stopCompactReasoning;
function reading(active) {
    if (!active && portraitViewer?.open) portraitViewer.close();
    const enabled = active && mobile.matches && !original();
    root.toggleAttribute('data-tide-reading', enabled);
    const chat = document.getElementById('chat');
    if (enabled && chat) stopCompactReasoning ??= compactReasoning(chat);
    else if (stopCompactReasoning) {
        stopCompactReasoning();
        stopCompactReasoning = null;
    }
}
document.body.append(frame, dock);
function syncPortrait(){
    if (!mobile.matches || original()) return;
    const c = ctx();
    const members = c.groups?.find(g=>String(g.id)===String(c.groupId))?.members || [];
    const avatar = c.groupId ? (c.chat.findLast(m=>!m.is_user && members.includes(m.original_avatar))?.original_avatar || members[0]) : c.characters[c.characterId]?.avatar;
    if(avatar) root.style.setProperty('--tide-portrait', `url("/characters/${encodeURIComponent(avatar)}")`);
    else root.style.removeProperty('--tide-portrait');
    root.toggleAttribute('data-tide-portrait',Boolean(avatar));
}
function appearance(){
    const active = mobile.matches && !original();
    root.toggleAttribute('data-tide-mobile', active);
    const dark = pref().getItem('tide-mobile-night') === '1';
    root.toggleAttribute('data-tide-night', active && dark);
    dock.hidden = !mobile.matches || !frame.hidden || !showLauncher();
    return dark;
}
function toggleNight(){pref().setItem('tide-mobile-night',appearance()?'0':'1');return appearance()}

function hide(){finishStartup();reading(false);toolModule?.closeTool();frame.hidden=true;frame.contentWindow?.suspendTide?.();appearance()}
function show(){
    if (!mobile.matches) return;
    pref().setItem('tide-mobile-original','0');
    // The launch control stays accessible while the frame is loading.
    if (!frame.src) frame.src = new URL('shell.html',import.meta.url).href;
    else if(frame.contentWindow?.showTideHome){frame.hidden=false;appearance();frame.contentWindow.showTideHome()}
}
function openFromMenu() {
    if (!mobile.matches) return;
    if (root.hasAttribute('data-tide-tool')) toolModule?.closeTool();
    else {
        const drawer = document.querySelector('#extensions-settings-button');
        if (drawer?.querySelector(':scope > .openDrawer')) drawer.querySelector(':scope > .drawer-toggle')?.click();
    }
    show();
}
launcher.onclick = openFromMenu;
function mountLaunchControls() {
    const settings = document.getElementById('extensions_settings');
    if (settings && !document.getElementById('tide-launch-settings')) {
        const section = document.createElement('div');
        section.id = 'tide-launch-settings';
        section.innerHTML = `<div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <strong>潮汐来信</strong>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <button type="button" class="menu_button">打开潮汐来信</button>
                <label class="checkbox_label"><input type="checkbox">在原版酒馆显示悬浮按钮</label>
                <p></p>
                <small data-tide-source>星垂 · <a href="https://github.com/Alina12901/tide-mobile-lite" target="_blank" rel="noopener noreferrer">官方仓库</a></small>
            </div>
        </div>`;
        section.querySelector('.inline-drawer-toggle').addEventListener('click', async () => {
            // Read only the local release label when this drawer is first opened.
            try {
                const response = await fetch(new URL('./provenance.json', import.meta.url));
                if (!response.ok) return;
                const release = await response.json();
                section.querySelector('[data-tide-source]').append(` · 溯源码 ${release.code}`);
            } catch { /* The source link also works without the local label. */ }
        }, { once: true });
        section.querySelector('p').textContent = reopenHint;
        section.querySelector('button').onclick = openFromMenu;
        const checkbox = section.querySelector('input');
        checkbox.checked = showLauncher();
        checkbox.onchange = () => {
            pref().setItem('tide-mobile-launcher', checkbox.checked ? '1' : '0');
            appearance();
        };
        settings.append(section);
    }
    const menu = document.getElementById('extensionsMenu');
    if (menu && !document.getElementById('tide-wand-launch')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'tide-wand-launch';
        button.className = 'list-group-item flex-container flexGap5';
        button.innerHTML = '<i aria-hidden="true" class="fa-solid fa-envelope-open-text extensionsMenuExtensionButton"></i><span>打开潮汐来信</span>';
        button.onclick = openFromMenu;
        menu.append(button);
    }
    for (const id of ['tide-launch-settings', 'tide-wand-launch']) {
        const control = document.getElementById(id);
        if (control) control.hidden = !mobile.matches;
    }
}
const drawerIds={'世界书':'WI-SP-button','API 连接':'sys-settings-button','预设与提示词':'ai-config-button','高级格式':'advanced-formatting-button','用户人设':'persona-management-button','群聊':'rightNavHolder','原版角色管理':'rightNavHolder','扩展与正则':'extensions-settings-button','酒馆背景':'backgrounds-button','用户设置':'user-settings-button'};
let opening=false;
window.starTideMobile={ctx,appearance,toggleNight,reading,reopenHint,
    atlasStore:()=>import('./atlas-store.js'),
    ready() {
        if (!mobile.matches || original()) return;
        frame.hidden = false;
        appearance();
        frame.contentWindow.showTideHome();
        // The initial home is built synchronously; recents can arrive later.
        if (startupCover && frame.contentDocument.querySelector('#home .tiles')) {
            requestAnimationFrame(() => requestAnimationFrame(finishStartup));
        }
    },
    restore(){pref().setItem('tide-mobile-original','1');hide()},
    async drawer(label,options={}){const id=drawerIds[label];if(!id)throw Error('这个工具暂时不可用');toolModule=await import('./tool-page.js');if(!mobile.matches||original()||frame.hidden)return;
        return toolModule.openTool({id,label,book:options.book,scope:options.scope,theme:toggleNight,back:()=>{frame.contentWindow?.refreshTideTheme?.();options.after?.()}})},
    async linkedBooks(ch){const {world_info}=await import('/scripts/world-info.js');return [...new Set([ch?.data?.extensions?.world,...(world_info?.charLore?.find(x=>x.name===ch?.avatar?.replace(/\.[^.]+$/,''))?.extraBooks||[]),ch?.data?.character_book?.name].filter(Boolean))]},
    async open({avatar,group,file}){if(opening)return;opening=true;try{
        const c=ctx();if(group){if(String(c.groupId)!==String(group)||c.chatId!==file)await c.openGroupChat(group,file)}
        else {const id=c.characters.findIndex(x=>x?.avatar===avatar);if(id<0)throw Error('该角色已不在角色库中');if(c.groupId||String(c.characterId)!==String(id))await c.selectCharacterById(id,{switchMenu:false});if(String(ctx().characterId)!==String(id))throw Error('暂时无法切换角色，请稍后重试');if(file&&ctx().chatId!==file)await ctx().openCharacterChat(file)}
        if (mobile.matches && !original()) {
            syncPortrait();
            frame.contentWindow.showTideChat();
        }
    }finally{opening=false}},
    heroGlobal(value) {
        if (typeof value === 'boolean') pref().setItem('tide-global-hero', value ? '1' : '0');
        return pref().getItem('tide-global-hero') === '1';
    },
    globalBackground() {
        if (background_settings.name === '__transparent.png') return '';
        // SillyTavern saves url("backgrounds/…") relative to its own page.
        // Resolve it there before passing the CSS value to the nested shell.
        const value = background_settings.url?.trim() || '';
        const match = /^url\(\s*(["']?)(.*?)\1\s*\)$/i.exec(value);
        if (!match?.[2]) return '';
        try {
            const absolute = new URL(match[2], document.baseURI);
            return `url(${JSON.stringify(absolute.href)})`;
        } catch {
            return '';
        }
    },
    async updateState(manual = false) {
        const { checkTideUpdate } = await import('./updates.js');
        return checkTideUpdate(ctx(), manual);
    },
    background(){return document.querySelector('#bg1')?.style.backgroundImage||''},
    async books(ch){const {world_info}=await import('/scripts/world-info.js');return [...new Set([ch.data?.extensions?.world,...(world_info.charLore?.find(x=>x.name===ch.avatar.replace(/\.[^.]+$/,''))?.extraBooks||[]),ch.data?.character_book?.name].filter(Boolean))].join('、')},
};
function adapt(){mountLaunchControls();if(!mobile.matches)hide();else if(!original())show();appearance()}
mobile.addEventListener('change',adapt);
ctx().eventSource.on(ctx().eventTypes.APP_READY,async () => {
    adapt();
    syncPortrait();
    if (document.getElementById('susage_container')) return;
    try {
        const { mountUsageTracker } = await import('./usage-tracker.js');
        mountUsageTracker();
    } catch (error) {
        console.error('[潮汐来信] 用量记账初始化失败', error);
    }
});
for(const event of ['CHAT_CHANGED','GROUP_UPDATED','MESSAGE_RECEIVED']){
    const type=ctx().eventTypes[event];
    if(type)ctx().eventSource.on(type,()=>{if(event!=='MESSAGE_RECEIVED'||ctx().groupId)syncPortrait();if(event==='CHAT_CHANGED' && root.hasAttribute('data-tide-reading'))frame.contentWindow?.refreshChatTitle?.()});
}

