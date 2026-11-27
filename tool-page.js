// Keep the live controls in their original DOM: delegated events, plugins, file
// pickers and dialogs continue to use the same document and the same state.
let session=null;
export function closeTool(){session?.close()}
export async function openTool({id,label,scope,book,theme,back}){
    if(session)return;
    const drawer=document.getElementById(id),panel=drawer?.querySelector(':scope > .drawer-content'),toggle=drawer?.querySelector(':scope > .drawer-toggle');
    if(!toggle||!panel)throw Error('这个版本的酒馆没有提供此面板。');
    const root=document.documentElement, head=document.createElement('header');
    head.id='tide-tool-head';head.innerHTML='<button type="button" aria-label="返回上一页">‹</button><div><small></small><b></b></div><button type="button" aria-label="切换日夜"></button>';
    head.querySelector('small').textContent=scope||'人间清欢　/　WORKSPACE';head.querySelector('b').textContent=label;
    for(const type of ['click','pointerdown','mousedown','touchstart','touchend'])head.addEventListener(type,e=>e.stopPropagation());
    const [ret,night]=head.querySelectorAll('button');function light(){night.textContent=root.hasAttribute('data-tide-night')?'☀':'☾'}night.onclick=()=>{theme();light()};light();
    const intro=document.createElement('div');
    intro.className='tide-tool-intro';
    const descriptions={
        'sys-settings-button':['当前连接',()=>document.querySelector('#main_api option:checked')?.textContent],
        'ai-config-button':['当前预设',()=>SillyTavern.getContext().getPresetManager?.()?.getSelectedPresetName?.()],
        'WI-SP-button':['当前书目',()=>document.querySelector('#world_editor_select option:checked')?.textContent],
    };
    const summary=descriptions[id];
    function refreshSummary(){
        if(!summary)return;
        intro.querySelector('b').textContent=summary[1]()?.trim() || '尚未选择';
    }
    if(summary){intro.innerHTML='<small></small><b></b>';intro.querySelector('small').textContent=summary[0];refreshSummary();panel.prepend(intro);panel.addEventListener('change',refreshSummary)}
    const wasOpen=panel.classList.contains('openDrawer'), prev=document.activeElement, scroll=panel.scrollTop;
    let live=true,opened=false;
    function close(){if(!live)return;live=false;session=null;observer.disconnect();intro.remove();panel.removeEventListener('change',refreshSummary);window.removeEventListener('keydown',esc,true);if(!wasOpen && panel.classList.contains('openDrawer'))toggle.click();panel.scrollTop=scroll;delete panel.dataset.tidePage;delete drawer.dataset.tideTarget;delete root.dataset.tideTool;head.remove();back?.();if(prev?.isConnected)prev.focus?.({preventScroll:true})}
    function esc(e){if(e.key!=='Escape'||document.querySelector('dialog[open], .select2-container--open, #shadow_popup:not([style*="display: none"])')?.getClientRects().length)return;e.stopImmediatePropagation();e.preventDefault();close()}
    const observer=new MutationObserver(()=>{if(panel.classList.contains('openDrawer'))opened=true;else if(opened)close()});observer.observe(panel,{attributes:true,attributeFilter:['class']});
    session={close};ret.onclick=close;window.addEventListener('keydown',esc,true);root.dataset.tideTool='';drawer.dataset.tideTarget='';panel.dataset.tidePage='';document.body.append(head);
    try{if(!wasOpen){const {doNavbarIconClick}=await import('/script.js');if(!live)return;await doNavbarIconClick.call(toggle);if(!live){if(panel.classList.contains('openDrawer'))toggle.click();return}}opened=true;
        if(book){const wi=await import('/scripts/world-info.js');if(!live)return;if(!wi.world_names?.includes(book))throw Error('这本书已不在酒馆书架上。');wi.reloadEditor(book,true);refreshSummary()}ret.focus({preventScroll:true});
    }catch(err){close();throw err}
}
