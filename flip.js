/**
 * 星垂 · 卡面翻转（手机端角色卡）
 *
 * 把「星垂 · 手机相册」这类手机端相册网格里的角色卡，换成可翻转的双面卡：
 *   正面 —— 封面、名字、作者备注，右上角一枚「翻开」
 *   背面 —— 纸页质感：角色小传预览 + 「进入聊天」
 *
 * 只在手机宽度（≤800px）、且角色列表确实是相册式网格时接管；
 * 换回别的主题或桌面端会自动退回原生角色卡，不留下痕迹。
 */

const CARD = 'star-flip-card';
const FACE = 'star-face';
const STAGE = 'star-stage';
const ROOT = 'star-flip-on';
const FLIPPED = 'is-flipped';
const STYLE_ID = 'star-flip-style';
const MAX_COVER_LOADS = 2;

const records = new WeakMap();

/**
 * 启动：在宿主页面里找到角色列表并接管。
 * @param {string} css 样式文本（原生扩展与酒馆助手脚本共用）
 */
export function enhanceBatch(cards) {
    const doc = document;
    const contextOf = parent.starTideMobile.ctx;
    const block = doc.getElementById('rm_print_characters_block');
    const list = contextOf().characters;
    for (const card of cards) enhance(card, list);
    if (!block.dataset.flipBound) {
        block.dataset.flipBound = '1';
        doc.documentElement.classList.add(ROOT);
        block.addEventListener('click', onClick, true);
        block.addEventListener('keydown', onKey);
    }
    const root = doc.documentElement;
    function enhance(card, list) {
        const id = Number(card.getAttribute('data-chid'));
        const character = Number.isInteger(id) ? list[id] : undefined;
        if (!character || typeof character.avatar !== 'string') return;

        const name = String(character.name || card.querySelector('.ch_name')?.textContent || '').trim() || '未名';
        const context = contextOf();
        const user = String(context?.name1 || '').trim() || '你';
        const note = brief(cleanText(character.data?.creator_notes, name, user), 54);
        const avatar = character.avatar && character.avatar !== 'none' ? character.avatar : '';
        const full = avatar ? avatarUrl(doc, avatar) : '';

        card.classList.add(CARD);
        card.tabIndex = 0;
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', `${name}，点按翻开角色小传`);

        const stage = el(doc, 'div', STAGE);
        const front = el(doc, 'div', `${FACE} star-front`);
        const back = el(doc, 'div', `${FACE} star-back`);

        /* 正面 */
        const cover = el(doc, 'img', 'star-cover');
        cover.alt = '';
        cover.draggable = false;
        cover.decoding = 'async';
        const thumb = context.getThumbnailUrl('avatar', avatar);
        if (full) {
            cover.loading = 'lazy';
            cover.src = thumb || full;
        } else {
            front.classList.add('is-blank');
            cover.remove();
            front.appendChild(el(doc, 'span', 'star-mono', name.slice(0, 1)));
        }
        if (full) front.appendChild(cover);

        const hint = el(doc, 'span', 'star-front-hint', '翻开');
        front.appendChild(hint);

        const title = el(doc, 'p', 'star-front-name', name);
        front.appendChild(title);

        if (note) {
            front.appendChild(el(doc, 'p', 'star-front-note', note));
        } else {
            front.classList.add('is-tight');
        }

        /* 背面 */
        const top = el(doc, 'div', 'star-back-top');
        top.appendChild(el(doc, 'span', 'star-back-kicker', '角 色 小 传'));
        top.appendChild(el(doc, 'span', 'star-back-no', `NO.${String(id + 1).padStart(2, '0')}`));
        back.appendChild(top);

        const nameNode = el(doc, 'p', 'star-back-name', name);
        back.appendChild(nameNode);
        back.appendChild(el(doc, 'span', 'star-back-rule'));

        const desc = el(doc, 'p', 'star-back-desc is-loading', '正在翻开这一页…');
        back.appendChild(desc);

        const enter = el(doc, 'button', 'star-enter');
        enter.type = 'button';
        enter.appendChild(el(doc, 'span', 'star-enter-label', '进入聊天'));
        const meta=el(doc,'div','meta');
        for(const label of ['世界书','预设']){const row=el(doc,'div','');row.append(el(doc,'i','',label),el(doc,'span',''));meta.append(row)}
        back.append(meta,enter);

        stage.appendChild(front);
        stage.appendChild(back);
        card.appendChild(stage);

        back.inert = true;
        records.set(card, { id, avatar, name, desc, front, back, loaded: false, loading: false });

        /* 让读出的简介即使有误也不会闪：先按需拉全文 */

    }

    /** 短句用更安静的排法，免得正文只在卡片中间占两行。 */
    function paintDesc(record, raw, user) {
        const found = snippet(raw, record.name, user);
        const empty = found.length < 4;
        const text = empty ? '这一页还没有写下小传。' : found;
        record.desc.textContent = text;
        record.desc.classList.remove('is-loading');
        record.desc.classList.toggle('is-quote', !empty && text.length <= 44);
        record.desc.classList.toggle('is-empty', empty);
        fitDesc(record);
    }

    /**
     * 卡片高度随屏幕宽度变，正文能放几行也跟着变。
     * 这里按实际高度取整数行，宁可少一行，也不要在卡片下沿留半截被切开的字。
     */
    function fitDesc(record) {
        record.fitted = true;
    }

    function setFlipped(card, on) {
        const record = records.get(card);
        if (!record) return;

        if (on) {
            for (const other of block.querySelectorAll(`.character_select.${CARD}.${FLIPPED}`)) {
                if (other !== card) setFlipped(other, false);
            }
            loadCard(card).then(async()=>{if(!card.isConnected)return;const c=contextOf(),ch=c.characters.find(x=>x?.avatar===record.avatar);if(!ch)return;const [world,preset]=record.back.querySelectorAll('.meta span');try{const bookNames=await parent.starTideMobile.linkedBooks(ch);world.replaceChildren(...bookNames.map(name=>{const link=el(document,'button','tide-book-link',name+' ›');link.type='button';link.dataset.book=name;link.ariaLabel='打开世界书：'+name;return link}));preset.textContent=c.getPresetManager()?.findPreset(ch.name)!=null?ch.name:''}catch{}});
        }

        card.classList.toggle(FLIPPED, on);
        card.setAttribute('aria-label', on ? `${record.name}，点按返回封面` : `${record.name}，点按翻开角色小传`);
        record.front.inert = on;
        record.back.inert = !on;
    }

    async function loadCard(card) {
        const record = records.get(card);
        if (!record || record.loaded || record.loading) return;
        record.loading = true;

        let text = '';
        try {
            let context = contextOf();
            let character = context?.characters?.[record.id];
            const canFetch = typeof context?.unshallowCharacter === 'function'
                && !character?.data?.description;
            if (canFetch) {
                await context.unshallowCharacter(String(record.id));
                context = contextOf();
                const index = context?.characters?.findIndex(item => item?.avatar === record.avatar) ?? -1;
                if (index >= 0) character = context.characters[index];
            }
            text = character?.data?.description ?? character?.description ?? '';
        } catch (error) {
            console.warn('[star-flip] 读取角色小传失败', error);
        }

        record.loading = false;
        record.loaded = true;
        const user = String(contextOf()?.name1 || '').trim() || '你';
        paintDesc(record, text, user);
    }

    /* ── 高清封面：缩略图先顶上，滚到附近再换原图 ──────────── */

    function onClick(event) {
        const target = event.target;
        if (!target || target.nodeType !== 1) return;
        if (!root.classList.contains(ROOT)) return;

        const card = target.closest(`.character_select.${CARD}`);
        if (!card || !block.contains(card)) return;

        // 「进入聊天」交回酒馆原生逻辑：它会记住选中角色并打开聊天
        if(target.closest('.tide-book-link'))return;
        if (target.closest('.star-enter')) {
            setFlipped(card, false);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setFlipped(card, !card.classList.contains(FLIPPED));
    }

    function onKey(event) {
        const target = event.target;
        if (!target || target.nodeType !== 1) return;
        const card = target.closest(`.character_select.${CARD}`);
        if (!card || target !== card) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setFlipped(card, !card.classList.contains(FLIPPED));
        } else if (event.key === 'Escape' && card.classList.contains(FLIPPED)) {
            event.preventDefault();
            setFlipped(card, false);
        }
    }

}

function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function avatarUrl(doc, avatar) {
    try {
        return new URL(`/characters/${encodeURIComponent(avatar)}`, doc.baseURI).href;
    } catch {
        return '';
    }
}

function brief(text, limit) {
    const value = String(text || '').trim();
    if (value.length <= limit) return value;
    return value.slice(0, limit).replace(/[，,、；;：:\s]+$/, '') + '…';
}

/**
 * 角色卡简介常是「设定表」：HTML、YAML、字段清单、台词混在一起。
 * 这里只取最像「小传」的那一两句。
 */
function isFieldRow(line) {
    const match = line.match(/^[-·•*]?\s*([^:：]{1,14})\s*[:：]\s*(.*)$/);
    if (!match) return false;
    const value = match[2].trim();
    if (!value) return true;
    if (/[。！？]/.test(value)) return false;
    return value.length <= 26;
}

function snippet(raw, name, user) {
    const text = cleanText(raw, name, user);
    if (!text) return '';

    const opening = text.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 3);
    const opensWithProse = opening.some(line => !isFieldRow(line) && line.length >= 16);

    if (!opensWithProse) {
        const sheet = sheetSnippet(text);
        if (sheet) return sheet;
    }

    const prose = proseSnippet(text);
    if (prose) return prose;

    return sheetSnippet(text) || brief(text, 140);
}

/** 普通散文型简介：取开头一两句人话。 */
function proseSnippet(text) {
    const pieces = [];
    let length = 0;
    let fieldStreak = 0;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        if (isFieldRow(line)) {
            fieldStreak += 1;
            if (length >= 24 && fieldStreak >= 2) break;   // 读到这里，下面开始是设定表了
            continue;
        }
        fieldStreak = 0;

        for (const sentence of splitSentences(stripIntro(line))) {
            const value = sentence
                .replace(/^[”’」』]+/, '')
                .replace(/[“‘「『]+$/, '')
                .trim();
            if (value.length < 8 || !humanText(value)) continue;
            if ((value.match(/[|｜]/g) || []).length >= 2) continue;     // 标签表格行
            pieces.push(value);
            length += value.length;
            if (length >= 66) return pieces.join('');
        }
    }
    return pieces.join('');
}

function stripIntro(line) {
    return line.replace(/^(简介|前言|背景|概述|故事背景|角色简介|角色介绍|summary|description|intro)\s*[:：]\s*/i, '');
}

/** 至少得像中文句子，过滤掉模板标题、英文标注、代码碎片。 */
function humanText(value) {
    const cjk = (value.match(/[\u4e00-\u9fff]/g) || []).length;
    if (cjk < 6) return false;
    return cjk / value.length >= 0.34;
}

/* ── 设定表型简介：从「姓名: …」「性格特点: - …」里拼一小段 ── */

const CORE_KEYS = ['核心驱动力', '人物简介', '角色简介', '简介', '描述', '故事背景', '世界背景', '世界观', '背景', '设定', 'profile', 'description', 'background', 'personality', 'scenario'];
const TRAIT_KEYS = ['性格特点', '性格特征', '性格', '个性', '标签', '关键词', 'tags'];
const BIT_KEYS = ['年龄', '身份', '职业', '原型', '社会地位', '阵营', '种族'];

function sheetSnippet(text) {
    const { rows, items } = parseSheet(text);
    const traits = pickList(items, TRAIT_KEYS, 4);
    const bits = pickBits(rows);
    let core = pickRow(rows, CORE_KEYS, 16);
    if (!core) {
        core = Object.values(rows)
            .filter(value => value.length >= 16 && value.length <= 90)
            .sort((a, b) => b.length - a.length)[0] || '';
    }

    const parts = [];
    if (bits) parts.push(`${bits}。`);
    if (traits.length) parts.push(`${traits.join('、')}。`);
    if (core) parts.push(/[。！？]$/.test(core) ? core : `${core}。`);
    return parts.length ? brief(parts.join(''), 104) : '';
}

function parseSheet(text) {
    const rows = {};
    const items = {};
    let section = '';
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const bullet = line.match(/^[-·•*]\s*(.+)$/);
        if (bullet) {
            pushItem(items, section, unquote(bullet[1]));
            continue;
        }

        const pair = line.match(/^([^:：\s][^:：]{0,15})\s*[:：]\s*(.*)$/);
        if (pair) {
            section = pair[1].trim();
            const value = unquote(pair[2]);
            if (value) rows[section] = value;
            continue;
        }

        if (section) pushItem(items, section, unquote(line));
    }
    return { rows, items };
}

function pushItem(items, section, value) {
    if (!section || !value) return;
    const list = items[section] || (items[section] = []);
    if (!list.includes(value)) list.push(value);
}

function unquote(value) {
    return String(value || '')
        .replace(/^["“「『'']+/, '')
        .replace(/["”」』'',]+$/, '')
        .trim();
}

function pickRow(rows, names, min) {
    for (const name of names) {
        for (const [key, value] of Object.entries(rows)) {
            if (!key.includes(name) || value.length < min) continue;
            return value;
        }
    }
    return '';
}

function pickList(items, names, limit) {
    for (const name of names) {
        for (const [key, list] of Object.entries(items)) {
            if (!key.includes(name)) continue;
            const picked = list.filter(value => value.length >= 2 && value.length <= 14).slice(0, limit);
            if (picked.length) return picked;
        }
    }
    return [];
}

function pickBits(rows) {
    const bits = [];
    for (const name of BIT_KEYS) {
        for (const [key, value] of Object.entries(rows)) {
            if (!key.includes(name)) continue;
            if (!value || value.length > 12 || bits.includes(value)) continue;
            bits.push(/^\d+$/.test(value) && name === '年龄' ? `${value} 岁` : value);
            break;
        }
        if (bits.length >= 3) break;
    }
    return bits.join(' · ');
}

function splitSentences(text) {
    const enders = '。！？!?…';
    const closers = '”’」』）)》"\'\'"';
    const out = [];
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (!enders.includes(text[i])) continue;
        let end = i + 1;
        while (end < text.length && (enders.includes(text[end]) || closers.includes(text[end]))) end += 1;
        const piece = text.slice(start, end).trim();
        if (piece) out.push(piece);
        start = end;
        i = end - 1;
    }
    const tail = text.slice(start).trim();
    if (tail) out.push(tail);
    return out;
}

function cleanText(raw, name, user) {
    let text = String(raw ?? '');
    if (!text) return '';
    text = text
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|h\d)>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
    text = text.replace(/\{\{char\}\}/gi, name || '角色').replace(/\{\{user\}\}/gi, user || '你');
    text = text.replace(/[\u200b-\u200d\ufeff]/g, '');
    text = text.replace(/[*_`>#~]+/g, ' ');
    text = text.replace(/[ \t\u3000]+/g, ' ').replace(/\s*\n\s*/g, '\n');
    return text.replace(/\n{2,}/g, '\n').trim();
}

