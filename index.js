const ctx = () => SillyTavern.getContext();
const mobile = matchMedia('(max-width:800px), (pointer:coarse) and (max-height:800px) and (orientation:landscape)');
const root = document.documentElement;
const pref = () => ctx().accountStorage;
const showLauncher = () => pref().getItem('tide-mobile-launcher') !== '0';
const reopenHint = '如果想再打开，就在魔术棒里或是拓展这打开，浮在页面上的按钮可以选择存在或关闭。';
const original = () => pref().getItem('tide-mobile-original') === '1';
// Dress the existing startup loader. Its lifetime stays with SillyTavern, including
// early dismissal for onboarding and errors that need the user's attention.
const startupLoader = mobile.matches && !original() && document.querySelector('#loader.splash-screen');
if (startupLoader) {
    startupLoader.classList.add('tide-letter');
    const caption = document.createElement('div');
    caption.className = 'tide-letter-caption';
    caption.setAttribute('role', 'status');
    caption.textContent = '载入中…';
    startupLoader.append(caption);
}
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
function reading(active) {
    root.toggleAttribute('data-tide-reading', active && mobile.matches && !original());
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

function hide(){reading(false);toolModule?.closeTool();frame.hidden=true;frame.contentWindow?.suspendTide?.();appearance()}
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
        const section = document.createElement('details');
        section.id = 'tide-launch-settings';
        section.innerHTML = `<summary class="inline-drawer-header"><b>潮汐来信</b></summary>
            <button type="button" class="menu_button">打开潮汐来信</button>
            <label class="checkbox_label"><input type="checkbox">在原版酒馆显示悬浮按钮</label>
            <p></p>`;
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
const drawerIds={'世界书':'WI-SP-button','API 连接':'sys-settings-button','预设与提示词':'ai-config-button','高级格式':'advanced-formatting-button','用户人设':'persona-management-button','群聊':'rightNavHolder','原版角色管理':'rightNavHolder','扩展与正则':'extensions-settings-button','酒馆背景':'backgrounds-button','偏好与快捷指令':'user-settings-button','用户设置':'user-settings-button'};
let opening=false;
window.starTideMobile={ctx,appearance,toggleNight,reading,reopenHint,
    atlasStore:()=>import('./atlas-store.js'),
    ready(){if(mobile.matches&&!original()){frame.hidden=false;appearance();frame.contentWindow.showTideHome()}},
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
    background(){return document.querySelector('#bg1')?.style.backgroundImage||''},
    async books(ch){const {world_info}=await import('/scripts/world-info.js');return [...new Set([ch.data?.extensions?.world,...(world_info.charLore?.find(x=>x.name===ch.avatar.replace(/\.[^.]+$/,''))?.extraBooks||[]),ch.data?.character_book?.name].filter(Boolean))].join('、')},
};
function adapt(){mountLaunchControls();if(!mobile.matches)hide();else if(!original())show();appearance()}
mobile.addEventListener('change',adapt);
ctx().eventSource.on(ctx().eventTypes.APP_READY,()=>{adapt();syncPortrait()});
for(const event of ['CHAT_CHANGED','GROUP_UPDATED','MESSAGE_RECEIVED']){
    const type=ctx().eventTypes[event];
    if(type)ctx().eventSource.on(type,()=>{if(event!=='MESSAGE_RECEIVED'||ctx().groupId)syncPortrait();if(event==='CHAT_CHANGED' && root.hasAttribute('data-tide-reading'))frame.contentWindow?.refreshChatTitle?.()});
}

