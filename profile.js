// Use text nodes for card-authored material. Long fields are mounted on first expansion.
function field(label, value) {
    const item = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = label;
    item.append(summary);
    item.addEventListener('toggle', () => {
        if (!item.open || item.childElementCount > 1) return;
        const text = document.createElement('div');
        text.className = 'profile-text';
        text.textContent = value || '未填写';
        item.append(text);
    });
    return item;
}

export function mountProfile(container, character, resolveCharacter) {
    const panel = document.createElement('details');
    panel.className = 'glass tide-profile';
    const heading = document.createElement('summary');
    if (character.avatar && character.avatar !== 'none') {
        const portrait = document.createElement('img');
        portrait.alt = '';
        portrait.decoding = 'async';
        portrait.src = parent.starTideMobile.ctx().getThumbnailUrl('avatar', character.avatar);
        heading.append(portrait);
    }
    const label = document.createElement('span');
    label.textContent = character.name || '角色';
    const action = document.createElement('small');
    action.textContent = '查看设定';
    heading.append(label, action);
    const body = document.createElement('div');
    body.className = 'profile-fields';
    panel.append(heading, body);
    container.append(panel);
    let status = 'idle';
    panel.addEventListener('toggle', async () => {
        action.textContent = panel.open ? '收起设定' : '查看设定';
        if (!panel.open || status !== 'idle') return;
        status = 'loading';
        body.textContent = '正在读取角色设定…';
        try {
            const ch = await resolveCharacter(character);
            if (!panel.isConnected) return;
            const data = ch.data || {};
            const value = key => data[key] || ch[key] || '';
            const description = field('角色描述', value('description'));
            description.open = true;
            const items = [description, field('开场白', value('first_mes'))];
            const alternatives = value('alternate_greetings');
            if (Array.isArray(alternatives)) alternatives.forEach((greeting, i) => items.push(field(`备选开场白 ${i + 1}`, greeting)));
            for (const [key, title] of [['personality','性格'], ['scenario','情景设定'], ['mes_example','对话示例'], ['creator_notes','作者备注'], ['system_prompt','系统提示词'], ['post_history_instructions','历史后指令']]) {
                if (value(key)) items.push(field(title, value(key)));
            }
            body.replaceChildren(...items);
            status = 'ready';
        } catch {
            status = 'idle';
            body.textContent = '读取失败，收起后再点一次可重试。';
        }
    });
}
