// ==========================================
// 設定（ここを書き換えれば報告先を変えられます）
// ==========================================
// Googleフォームを作ったら、そのURLに書き換えてください。
// 空のままなら、GitHubの「Issues（報告）」ページにつながります。
const FEEDBACK_URL = 'https://forms.gle/EiuK2cFBpW7pL8ai7';

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
const PLATFORM_LABEL = {
    both:   { icon: '💻📱', text: 'PC・スマホ' },
    pc:     { icon: '💻',   text: 'PCのみ' },
    mobile: { icon: '📱',   text: 'スマホのみ' }
};
function platformOf(tool) { return tool.platform || 'both'; }
function platformBadge(tool) {
    const p = PLATFORM_LABEL[platformOf(tool)];
    return `<span class="pf-badge pf-${platformOf(tool)}">${p.icon} ${p.text}</span>`;
}

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
    document.querySelectorAll('input[name="pricing"], input[name="japanese"], input[name="platform"]').forEach(r => r.addEventListener('change', filterTools));
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
        platform: (document.querySelector('input[name="platform"]:checked') || { value: 'all' }).value,
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
        const pf = platformOf(tool);
        if (s.platform === 'pc' && pf === 'mobile') return false;
        if (s.platform === 'mobile' && pf === 'pc') return false;
        if (s.platform === 'both' && pf !== 'both') return false;
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
    updateCategoryInfo(cats);
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
            ${platformBadge(tool)}
        </td>
        <td class="tool-company col-company">${esc(tool.company)}</td>
        <td class="tool-country">${esc(tool.country)}</td>
        <td class="tool-jp col-jp">${jpBadge(tool)}</td>
        <td class="tool-category col-category"><div class="cat-tags">${tool.category.map(c => `<span class="cat-tag">${esc(c)}</span>`).join('')}</div></td>
        <td class="tool-strengths"><ul class="strength-list">${tool.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></td>
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
                <p class="card-meta">${esc(tool.country)}　日本語 ${jpBadge(tool)}　${platformBadge(tool)}</p>
            </div>
            ${favButton(tool)}
        </div>
        <div class="card-badges">${PRICING_BADGE[tool.pricing] || ''} ${extraBadges(tool)}</div>
        <ul class="strength-list card-strengths">${tool.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
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
            <dt>使う端末</dt><dd>${platformBadge(tool)}</dd>
            <dt>できること</dt><dd>${tool.category.map(esc).join('、')}</dd>
            <dt>強み</dt><dd><ul class="strength-list">${tool.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></dd>
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
    if (s.platform !== 'all') p.set('device', s.platform);
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
    const device = p.get('device');
    if (device) { const r = document.querySelector(`input[name="platform"][value="${device}"]`); if (r) r.checked = true; }
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
    const pfAll = document.querySelector('input[name="platform"][value="all"]');
    if (pfAll) pfAll.checked = true;
    document.getElementById('noSignupFilter').checked = false;
    document.getElementById('favFilter').checked = false;
    history.replaceState(null, '', location.pathname);
    setSort(null, 'asc');
}

// ==========================================
// 目的（カテゴリ）の説明
//  ① チェックした目的の短い説明を結果の上に表示
//  ② 「目的の説明を見る」で全項目の詳しい説明を表示
// ==========================================
const CATEGORY_GUIDE = [
    { group: '👑 特別な項目', items: [
        { cat: 'よく使われるAIのTOP10', icon: '👑',
          short: '世界で実際によく使われているAIを10個選んだものです。何から試せばいいか迷ったら、まずここから。',
          long: 'アクセス解析会社Similarwebの世界ランキングをもとに選んでいます。',
          ex: 'ChatGPT、Gemini、Claude、DeepSeek、Grok' },
        { cat: '日本語特化', icon: '🇯🇵',
          short: '日本の会社が作ったAIや、日本語に特に強いAIです。',
          long: '日本語の文章や音声の自然さを重視したい方向けです。日本語の読み上げ、文字起こし、校正などがそろっています。',
          ex: 'VOICEVOX、Notta、Felo、Shodo' }
    ]},
    { group: '🤖 会話・調べもの', items: [
        { cat: 'パーソナルアシスタント', icon: '🤖',
          short: '会話でなんでも頼める、いわゆる「AIチャット」です。用途が決まっていないときの万能型です。',
          long: '質問への回答、文章作成、アイデア出し、相談など、幅広く使えます。迷ったらまずこの中から選ぶのがおすすめです。',
          ex: 'ChatGPT、Claude、Gemini、Copilot' },
        { cat: '情報検索・リサーチ', icon: '🔍',
          short: 'Webを検索して最新情報を集め、情報元のリンク付きで答えてくれるAIです。',
          long: '普通のチャットAIと違い、その場でWebを調べて答えます。出典が表示されるので、情報が正しいか自分で確かめられます。',
          ex: 'Perplexity、Felo、Genspark' },
        { cat: '要約と構造化', icon: '📝',
          short: '長い文章・PDF・動画を短くまとめたり、見出しや図に整理したりするAIです。',
          long: '「構造化」とは、バラバラな情報を見出し・箇条書き・マインドマップなどに整理することです。資料を読む時間を減らせます。',
          ex: 'NotebookLM、Mapify、ChatPDF' },
        { cat: '論文・リサーチ分析', icon: '🔬',
          short: '学術論文を探したり、内容を分析したりする専門的なAIです。',
          long: '一般の検索AIより、根拠となる研究を重視します。大学生・研究者・医療従事者向けです。',
          ex: 'Consensus、Elicit、Semantic Scholar' },
        { cat: '悩み相談', icon: '💬',
          short: '話し相手になってくれるAIや、気持ちの整理を手伝うAIです。専門家の代わりにはなりません。',
          long: '気軽に話を聞いてもらったり、気分を記録したりできます。つらい気持ちが強いときは、人の相談窓口も頼ってください。',
          ex: 'Pi、cotomo、awarefy' }
    ]},
    { group: '💻 開発・プログラミング', items: [
        { cat: 'ノーコードでアプリ作成', icon: '🧩',
          short: 'プログラミングを知らなくても、文章で指示するだけでアプリやWebサイトを作れるAIです。',
          long: '「こういうアプリを作って」と頼むと、AIが画面や動作を作ってくれます。アプリ作りが初めての方はここから。',
          ex: 'Bolt.new、Lovable、Dify、Replit' },
        { cat: '開発者向けツール', icon: '🛠️',
          short: 'プログラムを書ける人が、AIを使ったシステムを作るための部品や道具です。',
          long: 'ライブラリ（プログラムの部品集）、データベース、AIモデル本体などです。プログラミングの知識が必要です。',
          ex: 'LangChain、PyTorch、Hugging Face、Ollama',
          hint: 'プログラミングが初めてなら「ノーコードでアプリ作成」がおすすめです。', hintCat: 'ノーコードでアプリ作成' },
        { cat: 'コード補完', icon: '⌨️',
          short: 'プログラムを書いている途中で、AIが続きを予測して提案してくれます。',
          long: 'スマホの予測変換のプログラム版です。エラーの修正やコードの説明もしてくれます。',
          ex: 'GitHub Copilot、Cursor、Gemini Code Assist' },
        { cat: 'Android開発', icon: '📱',
          short: 'Androidアプリ作りに役立つAIです。Android StudioやKotlinに対応しています。',
          long: 'Android Studioに組み込まれたAIや、ノーコードでスマホアプリを作れるツールを集めています。',
          ex: 'Gemini in Android Studio、FlutterFlow' },
        { cat: 'ゲーム開発', icon: '🎮',
          short: 'キャラクターや3Dの素材作り、ゲームそのものの作成に役立つAIです。',
          long: 'ゲーム素材の生成、ゲーム内キャラクターとの会話、会話だけでゲームを作れるツールなどがあります。',
          ex: 'Unity AI、Meshy、Rosebud AI、Leonardo.Ai' }
    ]},
    { group: '🎨 画像・動画・音声', items: [
        { cat: '画像作成', icon: '🎨',
          short: '文章で指示すると、イラストや写真のような画像をゼロから作るAIです。',
          long: 'いわゆる「画像生成AI」です。作った画像を仕事で使う場合は、商用利用できるか利用規約を確認しましょう。',
          ex: 'Bing Image Creator、Adobe Firefly、Ideogram',
          hint: '手元の写真を加工したいなら「画像編集」です。', hintCat: '画像編集' },
        { cat: '画像編集', icon: '✂️',
          short: 'すでにある写真や画像を加工するAIです。背景除去、不要物の消去、高画質化など。',
          long: '背景を消す、写り込んだ物を消す、小さい画像をきれいに拡大する、といった作業が数秒でできます。',
          ex: 'remove.bg、Upscayl、Photopea',
          hint: 'ゼロから画像を作りたいなら「画像作成」です。', hintCat: '画像作成' },
        { cat: '3Dモデル生成', icon: '🧊',
          short: '文章や画像から、立体的な3Dデータを作るAIです。',
          long: 'ゲームの素材、3Dプリンター、Webの立体表示などに使えます。',
          ex: 'Meshy、Tripo AI、Spline' },
        { cat: '動画作成', icon: '🎬',
          short: '映像の生成、AIアバターが話す動画、撮った動画の編集などができるAIです。',
          long: '文章や画像から映像を作るもの、人のアバターが話す動画を作るもの、字幕付けなど編集を楽にするものの3種類があります。',
          ex: 'Kling AI、HeyGen、CapCut、Vrew' },
        { cat: '音楽・音声生成', icon: '🎵',
          short: '作曲、BGM作り、文章の読み上げ、声づくりなど、音を作るAIです。',
          long: '歌やBGMを作るもの、文章を読み上げるもの、曲からボーカルだけを取り出すものがあります。',
          ex: 'Suno、SOUNDRAW、VOICEVOX、ElevenLabs',
          hint: '話した声を文字にしたいなら「音声認識」です。', hintCat: '音声認識' },
        { cat: '音声認識', icon: '🎙️',
          short: '話した声を文字にするAIです（文字起こし）。議事録や字幕づくりに使えます。',
          long: '会議の録音から議事録を作ったり、動画に字幕を付けたりできます。音声生成（文字→声）とは逆の方向です。',
          ex: 'Notta、Whisper、Otter.ai',
          hint: '文章を声で読み上げたいなら「音楽・音声生成」です。', hintCat: '音楽・音声生成' },
        { cat: 'デザイン・UI/UX', icon: '🖌️',
          short: 'ロゴ、スライド、チラシ、アプリ画面など、見た目を整えるAIです。',
          long: 'UIは「画面の見た目やボタンの配置」、UXは「使いやすさや体験」のことです。',
          ex: 'Canva、Gamma、Figma、Looka' }
    ]},
    { group: '✍️ 文章・言葉', items: [
        { cat: 'テキスト生成・AI執筆', icon: '✍️',
          short: 'ブログ記事、広告文、メールなど、まとまった文章を書くことに特化したAIです。',
          long: '文章の校正（誤字チェック）や言い換えができるものも含みます。',
          ex: 'Writesonic、Shodo、Catchy' },
        { cat: '言語・翻訳', icon: '🌐',
          short: '外国語を翻訳するAIです。文章、看板の写真、会話、Webページなどを翻訳できます。',
          long: '契約書など大事な文章は、翻訳結果を人の目でも確認しましょう。',
          ex: 'DeepL、Google翻訳、Papago' },
        { cat: '学習・教育', icon: '📚',
          short: '問題の解き方の説明、単語の暗記、英会話の練習など、勉強を助けるAIです。',
          long: '数学の途中式を教えてくれるもの、語学を続けやすくするもの、発音を採点するものなどがあります。',
          ex: 'Photomath、Duolingo、ELSA Speak' }
    ]},
    { group: '📊 仕事・業務', items: [
        { cat: 'データ分析・予測', icon: '📊',
          short: '数字のデータから傾向を読み取り、グラフ作成や将来の予測をするAIです。',
          long: '「売上データから来月を予測する」といった使い方ができます。',
          ex: 'Julius AI、KNIME、Wolfram Alpha' },
        { cat: 'Excel・事務作業', icon: '🗂️',
          short: 'Excel関数づくり、表の整理、議事録作成など、事務作業を楽にするAIです。',
          long: '会社のデータを入れる前に、社内ルールでAIの利用が認められているか確認しましょう。',
          ex: 'Formula Bot、Power Automate Desktop、Notta',
          hint: '複数の作業をつないで自動化したいなら「RPA・自動化」です。', hintCat: 'タスクの自動化（RPA連携）' },
        { cat: 'タスクの自動化（RPA連携）', icon: '⚙️',
          short: 'パソコンの繰り返し作業を、ロボットのように自動で代わりにやらせる仕組みです。',
          long: '「メールが届いたら内容をExcelに記録する」のように、アプリ同士をつないで作業を自動化します。',
          ex: 'Power Automate Desktop、Zapier、Make、n8n' }
    ]},
    { group: '🏥 専門分野', items: [
        { cat: '医療・ヘルスケア', icon: '🏥',
          short: '症状から受診の目安を調べるAIや、医療従事者向けのAIです。',
          long: '医師の診断の代わりにはなりません。あくまで参考情報として使いましょう。',
          ex: 'ユビー（Ubie）、Ada、OpenEvidence' },
        { cat: '製造・ロボティクス', icon: '🦾',
          short: '工場の外観検査、ロボットのシミュレーション、物体の見分けなどに使うAIです。',
          long: '専門的なツールが多く、主に技術者・研究者向けです。',
          ex: 'Ultralytics YOLO、ROS 2、Roboflow' }
    ]}
];

const CONFUSING_PAIRS = [
    ['画像作成 ／ 画像編集', 'ゼロから作る ／ 手元の画像を加工する'],
    ['音楽・音声生成 ／ 音声認識', '文字から音を作る ／ 声を文字にする'],
    ['パーソナルアシスタント ／ 情報検索', 'なんでも会話 ／ Webを調べて出典付きで答える'],
    ['情報検索 ／ 論文・リサーチ分析', 'Web全般を調べる ／ 学術論文に絞って調べる'],
    ['ノーコードでアプリ作成 ／ 開発者向けツール', '文章の指示だけで作れる ／ プログラミングが必要'],
    ['コード補完 ／ 開発者向けツール', 'コードを書くのを手伝う ／ AIシステムを作る部品'],
    ['Excel・事務作業 ／ RPA・自動化', '1つの作業を楽にする ／ 複数の作業をつないで自動化']
];

const CATEGORY_MAP = {};
CATEGORY_GUIDE.forEach(g => g.items.forEach(i => CATEGORY_MAP[i.cat] = i));

// ① チェックした目的の説明を表示
function updateCategoryInfo(cats) {
    const box = document.getElementById('categoryInfo');
    if (!box) return;
    const list = cats.map(c => CATEGORY_MAP[c]).filter(Boolean);
    if (!list.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = list.map(i => `
        <div class="cat-info-item">
            <span class="cat-info-icon" aria-hidden="true">${i.icon}</span>
            <div>
                <strong>${esc(i.cat)}</strong>：${esc(i.short)}
                ${i.hint && !cats.includes(i.hintCat)
                    ? `<br><span class="cat-info-hint">💡 ${esc(i.hint)}
                       <button type="button" class="link-btn" data-pick-cat="${esc(i.hintCat)}">追加で表示する</button></span>` : ''}
            </div>
        </div>`).join('') +
        `<p class="cat-info-more"><button type="button" class="link-btn" data-open-guide>📘 すべての目的の説明を見る</button></p>`;
    box.hidden = false;
}

// ② すべての目的の説明
function openCategoryGuide() {
    const groups = CATEGORY_GUIDE.map(g => `
        <h3 class="guide-group">${g.group}</h3>
        ${g.items.map(i => {
            const n = allTools.filter(t => t.category.includes(i.cat)).length;
            return `<div class="guide-item">
                <div class="guide-item-head">
                    <h4>${i.icon} ${esc(i.cat)} <span class="count">(${n})</span></h4>
                    <button type="button" class="guide-pick" data-pick-cat="${esc(i.cat)}" data-only>このAIを表示</button>
                </div>
                <p>${esc(i.short)}${esc(i.long)}</p>
                <p class="guide-ex">例：${esc(i.ex)}</p>
            </div>`;
        }).join('')}`).join('');

    const pairs = CONFUSING_PAIRS.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="guide">
            <h2 id="modalTitle">📘 目的の説明</h2>
            <p class="guide-lead">やりたいことに近い目的を選んでください。「このAIを表示」を押すと、その目的のAIだけを表示します。</p>
            <h3 class="guide-group">🤔 迷いやすい組み合わせ</h3>
            <div class="guide-table-wrap"><table class="guide-table"><tbody>${pairs}</tbody></table></div>
            ${groups}
        </div>`;
    document.getElementById('modal').hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('.modal-close').focus();
}

document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('guideBtn');
    if (btn) btn.addEventListener('click', e => {
        e.preventDefault();   // 「目的で絞り込む」の開閉を止める
        e.stopPropagation();
        openCategoryGuide();
    });
});

document.addEventListener('click', e => {
    if (e.target.closest('[data-open-guide]')) { openCategoryGuide(); return; }
    const pick = e.target.closest('[data-pick-cat]');
    if (!pick) return;
    const cat = pick.dataset.pickCat;
    if (pick.hasAttribute('data-only')) {
        document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
    }
    const cb = [...document.querySelectorAll('.category-filter')].find(c => c.value === cat);
    if (cb) cb.checked = true;
    const det = document.getElementById('catDetails');
    if (det) det.open = true;
    closeModal();
    filterTools();
    document.querySelector('.results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
