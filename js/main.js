// ==========================================
// 設定（ここを書き換えれば報告先を変えられます）
// ==========================================
// Googleフォームを作ったら、そのURLに書き換えてください。
// 空のままなら、GitHubの「Issues（報告）」ページにつながります。
const FEEDBACK_URL = '';

// ==========================================
// データ・状態
// ==========================================
let allTools = [];
let currentSort = { key: null, direction: 'asc' };
let favorites = loadFavorites();
let currentView = 'pc';

const PRICING_BADGE = {
    '完全無料':     '<span class="badge badge-free">✅ 完全無料</span>',
    '無料枠あり':   '<span class="badge badge-freemium">🟢 無料枠あり</span>',
    'トライアルのみ': '<span class="badge badge-trial">⚠️ トライアルのみ</span>'
};
const JP_LABEL = { '◯': '日本語の画面あり', '△': '日本語で入力・出力できる', '×': '英語中心' };

// カテゴリごとの使い方のコツ・注意点（詳細ポップアップで表示）
const CATEGORY_TIPS = {
    '画像作成': '作った画像を商用利用できるかはサービスごとに違います。仕事で使う前に利用規約を確認しましょう。',
    '動画作成': '無料版は透かし（ロゴ）が入ることが多いです。商用利用の可否も利用規約で確認しましょう。',
    '音楽・音声生成': '作った曲や音声の著作権・商用利用の扱いはサービスごとに違います。実在の人の声をまねる使い方は避けましょう。',
    '3Dモデル生成': '生成した3Dモデルはそのままだと形が崩れていることがあります。ゲームに使う前に3Dソフトで確認しましょう。',
    '開発者向けツール': 'プログラミングの知識が必要なツールです。初めての方は「ノーコードでアプリ作成」から試すのがおすすめです。',
    'ノーコードでアプリ作成': '作ったアプリを公開する前に、個人情報を扱う部分がないか確認しましょう。',
    '言語・翻訳': '契約書など大事な文章は、翻訳結果を人の目でも確認しましょう。',
    '医療・ヘルスケア': '医師の診断の代わりにはなりません。症状が重いときや不安なときは医療機関を受診してください。',
    '悩み相談': 'AIは話し相手にはなりますが、専門家ではありません。つらい気持ちが強いときは人の相談窓口も頼ってください。',
    'パーソナルアシスタント': '答えが間違っていることもあります。大事な情報は公式サイトなどで確認しましょう。',
    'Excel・事務作業': '会社のデータを入れる前に、社内ルールでAIの利用が認められているか確認しましょう。',
    'タスクの自動化（RPA連携）': 'いきなり本番データで動かさず、テスト用のデータで動作を確かめてから使いましょう。'
};
const TOOL_NOTES = {
    'Character.AI': '未成年の利用には制限があります。詳しくは公式サイトで確認してください。',
    'Midjourney': '現在は有料プランが基本です。無料で試したい場合は他の画像生成AIもおすすめです。',
    'Digen AI': '開発企業の国は確認中です。'
};

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    setupDeviceButtons();
    detectDevice();
    showLastUpdated();
    setupFeedbackLink();
    setupEventListeners();
    loadTools();
});

// ==========================================
// 表示サイズ
// ==========================================
function setupDeviceButtons() {
    ['mobile', 'tablet', 'pc'].forEach(d => {
        document.getElementById('btn-' + d).addEventListener('click', () => setView(d));
    });
}

function detectDevice() {
    try {
        const saved = localStorage.getItem('preferredView');
        if (saved) { setView(saved, false); return; }
    } catch (e) {}
    const ua = navigator.userAgent;
    let device = 'pc';
    if (/Mobi|Android|iPhone|iPod/i.test(ua) && window.innerWidth <= 820) device = 'mobile';
    else if (/iPad|Tablet/i.test(ua)) device = 'tablet';
    setView(device, false);
}

function setView(device, save = true) {
    currentView = device;
    document.body.classList.remove('view-mobile', 'view-tablet', 'view-pc');
    document.body.classList.add('view-' + device);
    ['mobile', 'tablet', 'pc'].forEach(d =>
        document.getElementById('btn-' + d).classList.toggle('active', d === device));
    if (save) { try { localStorage.setItem('preferredView', device); } catch (e) {} }
    // スマホでは「目的で絞り込む」を最初は閉じておく
    const det = document.getElementById('catDetails');
    if (det) det.open = device !== 'mobile' || [...document.querySelectorAll('.category-filter:checked')].length > 0;
    if (allTools.length) filterTools();
}

// ==========================================
// 最終更新日（GitHubの最新コミット日）
// ==========================================
function formatDate(d) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function showLastUpdated() {
    const el = document.getElementById('lastUpdated');
    const owner = location.hostname.split('.')[0];
    const repo = location.pathname.split('/').filter(Boolean)[0];
    const fallback = () => {
        const v = window.dataLastUpdated;
        el.textContent = v ? formatDate(new Date(v + 'T00:00:00')) : '不明';
    };
    if (!location.hostname.endsWith('github.io') || !repo) { setTimeout(fallback, 800); return; }
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(list => { el.textContent = formatDate(new Date(list[0].commit.committer.date)); })
        .catch(() => setTimeout(fallback, 800));
}

// ==========================================
// 報告リンク
// ==========================================
function setupFeedbackLink() {
    const link = document.getElementById('feedbackLink');
    if (FEEDBACK_URL) { link.href = FEEDBACK_URL; return; }
    const owner = location.hostname.split('.')[0];
    const repo = location.pathname.split('/').filter(Boolean)[0];
    if (location.hostname.endsWith('github.io') && repo) {
        link.href = `https://github.com/${owner}/${repo}/issues/new`;
    } else {
        link.closest('.feedback').hidden = true;
    }
}

// ==========================================
// お気に入り（このブラウザに保存）
// ==========================================
function loadFavorites() {
    try { return new Set(JSON.parse(localStorage.getItem('favorites') || '[]')); }
    catch (e) { return new Set(); }
}
function saveFavorites() {
    try { localStorage.setItem('favorites', JSON.stringify([...favorites])); } catch (e) {}
    document.getElementById('favCount').textContent = favorites.size;
}
function toggleFavorite(name) {
    favorites.has(name) ? favorites.delete(name) : favorites.add(name);
    saveFavorites();
    filterTools();
    if (!document.getElementById('modal').hidden) openModal(name);
}

// ==========================================
// データ読み込み
// ==========================================
function loadTools() {
    fetch('data/ai-tools.json')
        .then(r => r.json())
        .then(data => {
            allTools = data.tools;
            window.dataLastUpdated = data.lastUpdated;
            document.getElementById('toolTotal').textContent = allTools.length;
            document.getElementById('favCount').textContent = favorites.size;
            updateFilterCounts();
            applyStateFromUrl();
            filterTools();
        })
        .catch(err => {
            console.error('データ読み込みエラー:', err);
            document.getElementById('noResults').hidden = false;
            document.getElementById('noResults').textContent = 'データを読み込めませんでした。ページを再読み込みしてください。';
        });
}

function updateFilterCounts() {
    document.querySelectorAll('.category-filter').forEach(cb => {
        const n = allTools.filter(t => t.category.includes(cb.value)).length;
        const label = cb.parentElement;
        let span = label.querySelector('.count');
        if (!span) { span = document.createElement('span'); span.className = 'count'; label.appendChild(span); }
        span.textContent = `(${n})`;
        label.style.display = n === 0 ? 'none' : '';
    });
}

// ==========================================
// イベント
// ==========================================
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterTools);
    document.querySelectorAll('.category-filter').forEach(cb => cb.addEventListener('change', filterTools));
    document.querySelectorAll('input[name="pricing"], input[name="japanese"]').forEach(r => r.addEventListener('change', filterTools));
    document.getElementById('noSignupFilter').addEventListener('change', filterTools);
    document.getElementById('favFilter').addEventListener('change', filterTools);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    document.getElementById('shareBtn').addEventListener('click', copyShareUrl);
    document.querySelectorAll('.sortable').forEach(th =>
        th.addEventListener('click', function () { sortTools(this.getAttribute('data-key')); }));
    document.getElementById('mobileSort').addEventListener('change', function () {
        if (!this.value) { setSort(null, 'asc'); }
        else { const [k, dir] = this.value.split(':'); setSort(k, dir); }
    });

    // 表・カード内のボタン（お気に入り・詳細）
    document.addEventListener('click', e => {
        const fav = e.target.closest('[data-fav]');
        if (fav) { toggleFavorite(fav.dataset.fav); return; }
        const det = e.target.closest('[data-detail]');
        if (det) { openModal(det.dataset.detail); return; }
        if (e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ==========================================
// ソート
// ==========================================
function sortTools(key) {
    if (currentSort.key === key) setSort(key, currentSort.direction === 'asc' ? 'desc' : 'asc');
    else setSort(key, 'asc');
}

function setSort(key, direction) {
    currentSort = { key, direction };
    document.querySelectorAll('.sortable').forEach(th => {
        const on = th.getAttribute('data-key') === key;
        th.querySelector('.sort-icon').textContent = on ? (direction === 'asc' ? '▲' : '▼') : '⇅';
        th.classList.toggle('sorted', on);
    });
    const sel = document.getElementById('mobileSort');
    const v = key ? `${key}:${direction}` : '';
    sel.value = [...sel.options].some(o => o.value === v) ? v : '';
    filterTools();
}

// ==========================================
// 絞り込み
// ==========================================
function getState() {
    return {
        q: document.getElementById('searchInput').value.trim(),
        cats: [...document.querySelectorAll('.category-filter:checked')].map(cb => cb.value),
        pricing: document.querySelector('input[name="pricing"]:checked').value,
        japanese: document.querySelector('input[name="japanese"]:checked').value,
        noSignup: document.getElementById('noSignupFilter').checked,
        fav: document.getElementById('favFilter').checked
    };
}

function getFilteredAndSortedTools() {
    const s = getState();
    const term = s.q.toLowerCase();

    let result = allTools.filter(tool => {
        const text = [tool.name, tool.company, tool.country, tool.pricing, tool.freeLimit,
                      ...tool.strengths, ...tool.category].join(' ').toLowerCase();
        if (term && !text.includes(term)) return false;
        if (s.cats.length && !s.cats.some(c => tool.category.includes(c))) return false;
        if (s.pricing === 'free' && tool.pricing !== '完全無料') return false;
        if (s.pricing === 'notrial' && tool.pricing === 'トライアルのみ') return false;
        if (s.japanese === 'o' && tool.japanese !== '◯') return false;
        if (s.japanese === 'oa' && tool.japanese === '×') return false;
        if (s.noSignup && !tool.noSignup) return false;
        if (s.fav && !favorites.has(tool.name)) return false;
        return true;
    });

    if (!currentSort.key && s.cats.includes('よく使われるAIのTOP10')) {
        result.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    }
    if (currentSort.key) {
        result.sort((a, b) => {
            const cmp = (a[currentSort.key] || '').localeCompare(b[currentSort.key] || '', 'ja');
            return currentSort.direction === 'asc' ? cmp : -cmp;
        });
    }
    return result;
}

function updateNotices(cats) {
    document.getElementById('notice-medical').hidden = !cats.includes('医療・ヘルスケア');
    document.getElementById('notice-consult').hidden = !cats.includes('悩み相談');
}

// ==========================================
// 表示
// ==========================================
function filterTools() {
    const tools = getFilteredAndSortedTools();
    updateNotices(getState().cats);
    document.getElementById('resultCount').textContent = tools.length;
    document.getElementById('noResults').hidden = tools.length !== 0;

    const tbody = document.getElementById('tableBody');
    const cards = document.getElementById('cardList');
    if (currentView === 'mobile') {
        tbody.innerHTML = '';
        cards.innerHTML = tools.map(createCard).join('');
    } else {
        cards.innerHTML = '';
        tbody.innerHTML = tools.map(createRow).join('');
    }
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function favButton(tool) {
    const on = favorites.has(tool.name);
    return `<button type="button" class="fav-btn${on ? ' on' : ''}" data-fav="${esc(tool.name)}"
        aria-pressed="${on}" title="${on ? 'お気に入りから外す' : 'お気に入りに追加'}">${on ? '★' : '☆'}</button>`;
}

function jpBadge(tool) {
    const cls = { '◯': 'jp-o', '△': 'jp-a', '×': 'jp-x' }[tool.japanese];
    return `<span class="jp-badge ${cls}" title="${JP_LABEL[tool.japanese]}">${tool.japanese}</span>`;
}

function extraBadges(tool) {
    return tool.noSignup ? '<span class="badge badge-nosign">🚪 登録不要</span>' : '';
}

function createRow(tool) {
    return `<tr>
        <td class="tool-name">
            ${tool.rank ? `<span class="rank-badge">👑 ${tool.rank}位</span><br>` : ''}
            <div class="name-line">${favButton(tool)}<button type="button" class="name-link" data-detail="${esc(tool.name)}">${esc(tool.name)}</button></div>
        </td>
        <td class="tool-company col-company">${esc(tool.company)}</td>
        <td class="tool-country">${esc(tool.country)}</td>
        <td class="tool-jp col-jp">${jpBadge(tool)}</td>
        <td class="tool-category col-category">${tool.category.map(esc).join(', ')}</td>
        <td class="tool-strengths">${tool.strengths.map(esc).join(', ')}</td>
        <td class="tool-free-limit">${PRICING_BADGE[tool.pricing] || ''} ${extraBadges(tool)}<br>${esc(tool.freeLimit)}</td>
        <td class="tool-link"><a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">開く →</a></td>
    </tr>`;
}

function createCard(tool) {
    return `<article class="tool-card">
        <div class="card-head">
            <div>
                ${tool.rank ? `<span class="rank-badge">👑 ${tool.rank}位</span>` : ''}
                <h3><button type="button" class="name-link" data-detail="${esc(tool.name)}">${esc(tool.name)}</button></h3>
                <p class="card-meta">${esc(tool.country)}　日本語 ${jpBadge(tool)}</p>
            </div>
            ${favButton(tool)}
        </div>
        <div class="card-badges">${PRICING_BADGE[tool.pricing] || ''} ${extraBadges(tool)}</div>
        <p class="card-strengths">${tool.strengths.map(esc).join(' ／ ')}</p>
        <p class="card-limit">${esc(tool.freeLimit)}</p>
        <div class="card-actions">
            <button type="button" class="detail-btn" data-detail="${esc(tool.name)}">詳しく見る</button>
            <a class="open-btn" href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">開く →</a>
        </div>
    </article>`;
}

// ==========================================
// 詳細ポップアップ
// ==========================================
function openModal(name) {
    const tool = allTools.find(t => t.name === name);
    if (!tool) return;
    const tips = tool.category.filter(c => CATEGORY_TIPS[c]).map(c => `<li>${esc(CATEGORY_TIPS[c])}</li>`);
    if (TOOL_NOTES[tool.name]) tips.unshift(`<li><strong>${esc(TOOL_NOTES[tool.name])}</strong></li>`);
    if (tool.pricing === 'トライアルのみ') tips.unshift('<li>無料で使えるのはお試し期間・お試し分だけです。有料プランへの自動更新に注意しましょう。</li>');

    document.getElementById('modalBody').innerHTML = `
        ${tool.rank ? `<span class="rank-badge">👑 よく使われるAI ${tool.rank}位</span>` : ''}
        <h2 id="modalTitle">${esc(tool.name)}</h2>
        <div class="card-badges">${PRICING_BADGE[tool.pricing] || ''} ${extraBadges(tool)}</div>
        <dl class="detail-list">
            <dt>開発企業</dt><dd>${esc(tool.company)}（${esc(tool.country)}）</dd>
            <dt>日本語対応</dt><dd>${jpBadge(tool)} ${JP_LABEL[tool.japanese]}</dd>
            <dt>できること</dt><dd>${tool.category.map(esc).join('、')}</dd>
            <dt>強み</dt><dd>${tool.strengths.map(esc).join('、')}</dd>
            <dt>無料の範囲</dt><dd>${esc(tool.freeLimit)}</dd>
        </dl>
        ${tips.length ? `<h3>使うときのポイント</h3><ul class="tips">${tips.join('')}</ul>` : ''}
        <div class="modal-actions">
            ${favButton(tool)}
            <a class="open-btn" href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">公式サイトを開く →</a>
        </div>`;
    document.getElementById('modal').hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('.modal-close').focus();
}

function closeModal() {
    const m = document.getElementById('modal');
    if (m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('modal-open');
}

// ==========================================
// 共有URL
// ==========================================
function buildShareUrl() {
    const s = getState();
    const p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.cats.length) p.set('cat', s.cats.join(','));
    if (s.pricing !== 'all') p.set('price', s.pricing);
    if (s.japanese !== 'all') p.set('jp', s.japanese);
    if (s.noSignup) p.set('nosign', '1');
    if (currentSort.key) p.set('sort', `${currentSort.key}:${currentSort.direction}`);
    const qs = p.toString();
    return location.origin + location.pathname + (qs ? '?' + qs : '');
}

function copyShareUrl() {
    const url = buildShareUrl();
    const btn = document.getElementById('shareBtn');
    const done = () => { btn.textContent = '✅ コピーしました'; setTimeout(() => btn.textContent = '🔗 この条件をURLでコピー', 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt('このURLをコピーしてください', url));
    else prompt('このURLをコピーしてください', url);
}

function applyStateFromUrl() {
    const p = new URLSearchParams(location.search);
    if (p.get('q')) document.getElementById('searchInput').value = p.get('q');
    const cats = (p.get('cat') || '').split(',').filter(Boolean);
    document.querySelectorAll('.category-filter').forEach(cb => cb.checked = cats.includes(cb.value));
    if (cats.length) document.getElementById('catDetails').open = true;
    const price = p.get('price');
    if (price) { const r = document.querySelector(`input[name="pricing"][value="${price}"]`); if (r) r.checked = true; }
    const jp = p.get('jp');
    if (jp) { const r = document.querySelector(`input[name="japanese"][value="${jp}"]`); if (r) r.checked = true; }
    document.getElementById('noSignupFilter').checked = p.get('nosign') === '1';
    const sort = p.get('sort');
    if (sort) { const [k, d] = sort.split(':'); if (['name', 'company', 'country'].includes(k)) setSort(k, d === 'desc' ? 'desc' : 'asc'); }
}

// ==========================================
// リセット
// ==========================================
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
    document.querySelector('input[name="pricing"][value="all"]').checked = true;
    document.querySelector('input[name="japanese"][value="all"]').checked = true;
    document.getElementById('noSignupFilter').checked = false;
    document.getElementById('favFilter').checked = false;
    history.replaceState(null, '', location.pathname);
    setSort(null, 'asc');
}
