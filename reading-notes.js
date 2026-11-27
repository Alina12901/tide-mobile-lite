// Read only the active reply. Swiping to a different variant must never reuse its notes.
function inlineNotes(message, settings) {
    const raw = typeof message?.mes === 'string' ? message.mes.trimStart() : '';
    const pairs = [[settings?.prefix, settings?.suffix], ['<think>', '</think>'], ['<thinking>', '</thinking>'], ['<reasoning>', '</reasoning>']];
    for (const [start, end] of pairs) {
        if (!start || !end || !raw.startsWith(start)) continue;
        const stop = raw.indexOf(end, start.length);
        if (stop >= 0) return { start, end, text: raw.slice(start.length, stop).trim() };
    }
    return null;
}
function notes(message, settings) {
    if (!message || message.is_user || message.is_system) return {};
    const inline = inlineNotes(message, settings);
    const extra = message.extra || {};
    const text = [extra.reasoning_display_text ?? extra.reasoning, extra.reasoning_content, inline?.text]
        .find(value => typeof value === 'string' && value.trim());
    return { text, inline };
}
export function reasoningStatus(context) {
    const message = context.chat.findLast(m => m && !m.is_user && !m.is_system);
    if (!message) return '等待角色回复';
    if (notes(message, context.powerUserSettings?.reasoning).text) return '这条回复有可展开的思考文字';
    return message.extra?.reasoning_duration > 0 ? '这条回复只记录了思考时长' : '这条回复未找到可显示的思考文字';
}
// A tag may be visible as escaped text, or filtered out by the character's own
// formatter. Only remove an exact, visible leading tag pair. Keep the story DOM live.
function moveVisiblePrefix(body, inline) {
    const first = body.textContent.trimStart();
    if (!first.startsWith(inline.start)) return;
    const end = first.indexOf(inline.end, inline.start.length);
    if (end < 0) return;
    let left = body.textContent.length - first.length + end + inline.end.length;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode()); left -= node.length) {
        if (left > node.length) continue;
        const range = document.createRange();
        range.setStart(body, 0);
        range.setEnd(node, left);
        const removed = range.extractContents();
        const marker = document.createComment('tide-inline');
        body.prepend(marker);
        return () => marker.replaceWith(removed);
    }
}
export function mountSavedNotes(chat, context) {
    const restorePrefix = new WeakMap();
    function sync(row) {
        const body = row.querySelector('.mes_block > .mes_text');
        if (!body) return;
        const message = context().chat[row.getAttribute('mesid')];
        const { text, inline } = notes(message, context().powerUserSettings?.reasoning);
        const native = row.querySelector('.mes_reasoning_details .mes_reasoning');
        let panel = body.parentNode.querySelector(':scope > .tide-saved-notes');
        if (!text || native?.textContent.trim()) { panel?.remove(); return; }
        if (inline && !body.querySelector('textarea') && body.firstChild?.nodeType !== Node.COMMENT_NODE) {
            const undo = moveVisiblePrefix(body, inline);
            if (undo) restorePrefix.set(row, undo);
        }
        if (!panel) {
            panel = document.createElement('details');
            panel.className = 'tide-saved-notes';
            const summary = document.createElement('summary');
            summary.textContent = '思考过程';
            panel.append(summary, document.createElement('div'));
            body.before(panel);
        }
        if (panel.lastChild.textContent !== text) panel.lastChild.textContent = text;
    }
    const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node.matches?.('.mes')) sync(node);
    });
    observer.observe(chat, { childList: true });
    chat.querySelectorAll(':scope > .mes').forEach(sync);
    const c = context(), listeners = [];
    const refresh = id => {
        const row = Number.isInteger(Number(id)) && chat.querySelector(`:scope > .mes[mesid="${Number(id)}"]`);
        if (row) sync(row);
    };
    for (const name of ['CHARACTER_MESSAGE_RENDERED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_REASONING_EDITED','MESSAGE_REASONING_DELETED','GENERATION_ENDED','GENERATION_STOPPED']) {
        const event = c.eventTypes[name];
        if (!event) continue;
        const handler = name.startsWith('GENERATION_') ? () => refresh(c.chat.length - 1) : refresh;
        c.eventSource.on(event, handler);
        listeners.push([event, handler]);
    }
    return () => {
        observer.disconnect();
        for (const [event, handler] of listeners) c.eventSource.removeListener(event, handler);
        for (const row of chat.querySelectorAll(':scope > .mes')) {
            row.querySelector('.tide-saved-notes')?.remove();
            restorePrefix.get(row)?.();
        }
    };
}
