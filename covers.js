// Keep a thumbnail during a fling. Only settled, visible covers compete for two decode slots.
const candidates = new Set();
const details = new WeakMap();
let observer, timer, active = 0;

function pump() {
    if (timer || !observer) return;
    for (const front of candidates) {
        if (active >= 2) break;
        const info = details.get(front);
        if (!info || info.loading || info.high || info.failed || !front.isConnected) continue;
        info.loading = true;
        active++;
        const image = info.thumb.cloneNode(false);
        image.loading = 'eager';
        image.src = info.url;
        image.decode().then(() => {
            if (!candidates.has(front) || !front.isConnected) return;
            info.thumb.replaceWith(image);
            info.high = image;
        }).catch(() => { info.failed = true; }).finally(() => {
            active--;
            info.loading = false;
            pump();
        });
    }
}
function settle() {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = 0; pump(); }, 140);
}
export function watchCover(front, thumb, url) {
    const album = document.querySelector('#album');
    if (!observer) {
        observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const front = entry.target;
                if (entry.isIntersecting) candidates.add(front);
                else {
                    candidates.delete(front);
                    const info = details.get(front);
                    if (info?.high) { info.high.replaceWith(info.thumb); info.high = null; }
                }
            }
            settle();
        }, {root:album});
        album.addEventListener('scroll', settle, {passive:true});
    }
    details.set(front, {thumb, url});
    observer.observe(front);
}
export function resetCovers() {
    observer?.disconnect();
    observer = null;
    candidates.clear();
    clearTimeout(timer);
    timer = 0;
    document.querySelector('#album').removeEventListener('scroll', settle);
}
