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

function platformOf(tool) { return tool.platform || 'both'; }

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
    window._lastDate = d;
    return T().date(d);
}

function showLastUpdated() {
    const el = document.getElementById('lastUpdated');
    const owner = location.hostname.split('.')[0];
    const repo = location.pathname.split('/').filter(Boolean)[0];
    const fallback = () => {
        const v = window.dataLastUpdated;
        el.textContent = v ? formatDate(new Date(v + 'T00:00:00')) : T().unknown;
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
    document.addEventListener('keydown', trapFocusInModal);
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
        th.setAttribute('aria-sort', on ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
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
        const text = [tool.name, tool.nameEn || '', tool.company, companyOf(tool), tool.country, COUNTRY_EN[tool.country] || '',
                      tool.pricing, PRICING_EN[tool.pricing] || '', tool.freeLimit, tool.freeLimitEn || '',
                      ...tool.strengths, ...(tool.strengthsEn || []),
                      ...tool.category, ...tool.category.map(c => CATEGORY_EN[c] || '')].join(' ').toLowerCase();
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
            const cmp = sortValueOf(a, currentSort.key).localeCompare(sortValueOf(b, currentSort.key), LANG);
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
let announceTimer = null;
function announce(text) {
    const live = document.getElementById('a11yLive');
    if (!live) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { live.textContent = ''; setTimeout(() => live.textContent = text, 50); }, 600);
}

function filterTools() {
    const tools = getFilteredAndSortedTools();
    announce(T().announce(tools.length));
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






// ==========================================
// 詳細ポップアップ
// ==========================================
let lastFocus = null;
function rememberFocus() {
    const m = document.getElementById('modal');
    if (m.hidden) lastFocus = document.activeElement;
}


function closeModal() {
    const m = document.getElementById('modal');
    if (m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
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
    if (isEn()) p.set('lang', 'en');
    const qs = p.toString();
    return location.origin + location.pathname + (qs ? '?' + qs : '');
}

function copyShareUrl() {
    const url = buildShareUrl();
    const btn = document.getElementById('shareBtn');
    const done = () => { btn.textContent = T().copied; setTimeout(() => btn.textContent = T().share, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt(T().copyPrompt, url));
    else prompt(T().copyPrompt, url);
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
    history.replaceState(null, '', location.pathname + (isEn() && new URLSearchParams(location.search).get('lang') ? '?lang=en' : ''));
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

// ② すべての目的の説明

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


// ==========================================
// 読み上げソフト・音声操作・キーボード操作への対応
//  （index.html を書き換えずに、ページを開いたときに自動で整えます）
// ==========================================
function trapFocusInModal(e) {
    const m = document.getElementById('modal');
    if (m.hidden || e.key !== 'Tab') return;
    const f = [...m.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')]
        .filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// 項目名の先頭にある絵文字を、読み上げでは飛ばす
function hideLeadingEmoji(el) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const m = node.textContent.match(/^(\s*)((?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]|[◯△＋])+\s*)/u);
    if (!m || !/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u.test(m[2])) return;
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.textContent = m[2];
    node.textContent = node.textContent.slice(m[0].length);
    el.insertBefore(span, node);
    if (m[1]) el.insertBefore(document.createTextNode(m[1]), span);
}

function setupAccessibility() {
    const body = document.body;

    // 1. 「検索結果へ移動」リンク（Tabキーを押すと最初に出てくる）
    const skip = document.createElement('a');
    skip.href = '#results';
    skip.className = 'skip-link';
    skip.textContent = '検索結果へ移動';
    body.insertBefore(skip, body.firstChild);

    // 2. 件数の読み上げ用（画面には見えない）
    const live = document.createElement('div');
    live.id = 'a11yLive';
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    body.appendChild(live);

    // 3. ページの区画に名前を付ける
    const search = document.querySelector('.search-area');
    if (search) { search.setAttribute('role', 'search'); search.setAttribute('aria-label', 'AIツールの検索と絞り込み'); }
    const results = document.querySelector('.results-area');
    if (results) {
        results.id = 'results';
        results.setAttribute('role', 'region');
        results.setAttribute('aria-label', '検索結果');
        results.setAttribute('tabindex', '-1');
    }
    const container = document.querySelector('.container');
    if (container) container.setAttribute('role', 'main');

    // 4. 表示サイズのボタン
    [['mobile', 'スマホ表示'], ['tablet', 'タブレット表示'], ['pc', 'PC表示']].forEach(([d, label]) => {
        const b = document.getElementById('btn-' + d);
        if (!b) return;
        b.setAttribute('aria-label', label);
        b.firstChild && b.firstChild.nodeType === 3 && hideLeadingEmoji(b);
    });
    const sw = document.querySelector('.device-switcher');
    if (sw) sw.setAttribute('aria-label', '表示サイズの切り替え');
    const syncPressed = () => ['mobile', 'tablet', 'pc'].forEach(d => {
        const b = document.getElementById('btn-' + d);
        if (b) b.setAttribute('aria-pressed', b.classList.contains('active'));
    });
    syncPressed();
    new MutationObserver(syncPressed).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // 5. 絞り込みのグループに名前を付ける
    document.querySelectorAll('.filter-group').forEach((g, i) => {
        const h = g.querySelector('.filter-title');
        if (!h) return;
        h.id = h.id || `filter-title-${i}`;
        const inner = g.querySelector('.radio-group');
        const isRadio = inner && inner.querySelector('input[type="radio"]');
        (inner || g).setAttribute('role', isRadio ? 'radiogroup' : 'group');
        (inner || g).setAttribute('aria-labelledby', h.id);
    });
    const cats = document.querySelector('.filters');
    if (cats) { cats.setAttribute('role', 'group'); cats.setAttribute('aria-label', '目的で絞り込む（複数選べます）'); }

    // 6. 項目名の先頭の絵文字を読み上げない
    document.querySelectorAll('.radio-group label, .filters label, .howto-link, .guide-btn, .share-button, .ai-warning, .hero-sub')
        .forEach(hideLeadingEmoji);
    document.querySelectorAll('.hero-icon').forEach(el => el.setAttribute('aria-hidden', 'true'));

    // 7. 表：見出しの並び替えをキーボード・音声操作でも使えるように
    const table = document.getElementById('resultsTable');
    if (table && !table.querySelector('caption')) {
        const cap = document.createElement('caption');
        cap.className = 'sr-only';
        cap.textContent = 'AIツールの一覧（AI・開発企業・国の見出しで並び替えできます）';
        table.insertBefore(cap, table.firstChild);
    }
    document.querySelectorAll('#resultsTable th').forEach(th => th.setAttribute('scope', 'col'));
    document.querySelectorAll('.sortable').forEach(th => {
        const label = th.childNodes[0].textContent.trim();
        const icon = th.querySelector('.sort-icon');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sort-btn';
        btn.textContent = label + ' ';
        btn.setAttribute('aria-label', `${label}で並び替え`);
        if (icon) { icon.setAttribute('aria-hidden', 'true'); btn.appendChild(icon); }
        th.textContent = '';
        th.appendChild(btn);
        th.setAttribute('aria-sort', 'none');
    });

    // 8. 検索欄
    const input = document.getElementById('searchInput');
    if (input) { input.type = 'search'; input.setAttribute('autocomplete', 'off'); }

    // 9. 選んだ目的の説明は、変わったときに読み上げる
    const info = document.getElementById('categoryInfo');
    if (info) info.setAttribute('aria-live', 'polite');

    // 10. 件数表示「(12)」を「12件」と読ませる
    const fixCounts = () => document.querySelectorAll('.filters .count').forEach(c => {
        if (c.dataset.a11y === c.textContent) return;
        const n = c.textContent.replace(/[()]/g, '');
        c.setAttribute('aria-label', `${n}件`);
        c.dataset.a11y = c.textContent;
    });
    new MutationObserver(fixCounts).observe(document.querySelector('.filters') || document.body, { childList: true, subtree: true });
    fixCounts();

    // 11. 詳細ポップアップ
    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) closeBtn.setAttribute('aria-label', '閉じる');
}

document.addEventListener('DOMContentLoaded', setupAccessibility);

// ==========================================
// 日本語 / English の切り替え
// ==========================================
const CATEGORY_EN = {
    'よく使われるAIのTOP10': 'Top 10 Most-Used AI', 'パーソナルアシスタント': 'Personal Assistant',
    '情報検索・リサーチ': 'Search & Research', 'ノーコードでアプリ作成': 'No-Code App Building',
    '開発者向けツール': 'Developer Tools', 'コード補完': 'Code Completion', 'Android開発': 'Android Development',
    'ゲーム開発': 'Game Development', '画像作成': 'Image Generation', '画像編集': 'Image Editing',
    '3Dモデル生成': '3D Model Generation', '動画作成': 'Video Creation', '音楽・音声生成': 'Music & Voice Generation',
    '音声認識': 'Speech Recognition', 'テキスト生成・AI執筆': 'Text Generation & Writing', 'デザイン・UI/UX': 'Design & UI/UX',
    '言語・翻訳': 'Language & Translation', '要約と構造化': 'Summarizing & Organizing', 'データ分析・予測': 'Data Analysis & Forecasting',
    'Excel・事務作業': 'Excel & Office Work', 'タスクの自動化（RPA連携）': 'Task Automation (RPA)', '学習・教育': 'Learning & Education',
    '悩み相談': 'Someone to Talk To', '論文・リサーチ分析': 'Academic Research', '医療・ヘルスケア': 'Medical & Healthcare',
    '製造・ロボティクス': 'Manufacturing & Robotics', '日本語特化': 'Japanese-Focused'
};
const COUNTRY_EN = {
    'アメリカ': 'USA', 'アラブ首長国連邦': 'UAE', 'イギリス': 'UK', 'イスラエル': 'Israel', 'インド': 'India',
    'ウクライナ': 'Ukraine', 'オランダ': 'Netherlands', 'オーストラリア': 'Australia', 'オーストリア': 'Austria',
    'カナダ': 'Canada', 'クロアチア': 'Croatia', 'シンガポール': 'Singapore', 'スイス': 'Switzerland',
    'スウェーデン': 'Sweden', 'スペイン': 'Spain', 'スロベニア': 'Slovenia', 'チェコ': 'Czechia', 'デンマーク': 'Denmark',
    'ドイツ': 'Germany', 'ニュージーランド': 'New Zealand', 'ノルウェー': 'Norway', 'フランス': 'France',
    'ブラジル': 'Brazil', 'ポーランド': 'Poland', 'ルクセンブルク': 'Luxembourg', 'ロシア': 'Russia', '中国': 'China',
    '中国（香港）': 'China (Hong Kong)', '日本': 'Japan', '要確認': 'Unconfirmed', '韓国': 'South Korea'
};
const COMPANY_EN = {
    '秘塔科技': 'Metaso Technology', '東京科学大学': 'Institute of Science Tokyo', '国立情報学研究所': 'National Institute of Informatics',
    'scikit-learnコミュニティ（Inria発）': 'scikit-learn community (from Inria)', 'UVRチーム': 'UVR team', 'ヒホ': 'Hiho',
    'ゼンプロダクツ': 'Zen Products', 'デジタルレシピ': 'Digital Recipe', 'リュブリャナ大学': 'University of Ljubljana'
};
const PRICING_EN = { '完全無料': 'Completely free', '無料枠あり': 'Free tier', 'トライアルのみ': 'Trial only' };
const DEFAULT_LIMIT_EN = {
    '完全無料': 'Free to use', '無料枠あり': 'Free plan (limits on usage or features)',
    'トライアルのみ': 'Free trial only (paid afterwards)'
};

const I18N = {
    ja: {
        pricing: p => p,
        jp: { '◯': '日本語の画面あり', '△': '日本語で入力・出力できる', '×': '英語中心' },
        jpPrefix: '日本語対応：', pfPrefix: '使う端末：', pricePrefix: '料金：',
        platform: { both: 'PC・スマホ', pc: 'PCのみ', mobile: 'スマホのみ' },
        noSignup: '登録不要', rank: n => `${n}位`, rankSr: 'よく使われるAI ', rankModal: n => `よく使われるAI ${n}位`,
        strengthsSr: '強み：', open: '開く', openLabel: n => `開く：${n}の公式サイト（新しいタブ）`,
        detail: '詳しく見る', detailLabel: n => `詳しく見る：${n}`, fav: n => `お気に入り：${n}`,
        favTitleOn: 'お気に入りから外す', favTitleOff: 'お気に入りに追加', japaneseWord: '日本語',
        dt: { company: '開発企業', jp: '日本語対応', pf: '使う端末', cats: 'できること', str: '強み', limit: '無料の範囲' },
        tipsTitle: '使うときのポイント', officialSite: '公式サイトを開く', newTab: '（新しいタブ）',
        trialTip: '無料で使えるのはお試し期間・お試し分だけです。有料プランへの自動更新に注意しましょう。',
        announce: n => `検索結果 ${n}件`, catSep: '、',
        date: d => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`, unknown: '不明',
        copied: '✅ コピーしました', share: '🔗 この条件をURLでコピー', copyPrompt: 'このURLをコピーしてください'
    },
    en: {
        pricing: p => PRICING_EN[p] || p,
        jp: { '◯': 'Japanese interface', '△': 'Works in Japanese', '×': 'Mainly English' },
        jpPrefix: 'Japanese: ', pfPrefix: 'Devices: ', pricePrefix: 'Price: ',
        platform: { both: 'PC & Phone', pc: 'PC only', mobile: 'Phone only' },
        noSignup: 'No sign-up', rank: n => `#${n}`, rankSr: 'Most-used AI ', rankModal: n => `Most-used AI #${n}`,
        strengthsSr: 'Strengths: ', open: 'Open', openLabel: n => `Open: ${n} official site (new tab)`,
        detail: 'Details', detailLabel: n => `Details: ${n}`, fav: n => `Favorite: ${n}`,
        favTitleOn: 'Remove from favorites', favTitleOff: 'Add to favorites', japaneseWord: 'Japanese',
        dt: { company: 'Developer', jp: 'Japanese', pf: 'Devices', cats: 'What it does', str: 'Strengths', limit: 'Free usage' },
        tipsTitle: 'Tips for using it', officialSite: 'Open official site', newTab: ' (new tab)',
        trialTip: 'Only the trial period or trial credits are free. Watch out for automatic renewal to a paid plan.',
        announce: n => `${n} results`, catSep: ', ',
        date: d => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), unknown: 'Unknown',
        copied: '✅ Copied', share: '🔗 Copy link to these filters', copyPrompt: 'Copy this URL'
    }
};

let LANG = detectLang();
function detectLang() {
    const p = new URLSearchParams(location.search).get('lang');
    if (p === 'en' || p === 'ja') return p;
    try { const s = localStorage.getItem('lang'); if (s === 'en' || s === 'ja') return s; } catch (e) {}
    return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
function T() { return I18N[LANG]; }
const isEn = () => LANG === 'en';

// データの表示用（英語のときは英語の項目を使う）
function nameOf(t) { return isEn() && t.nameEn ? t.nameEn : t.name; }
function countryOf(t) { return isEn() ? (COUNTRY_EN[t.country] || t.country) : t.country; }
function companyOf(t) { return isEn() ? (COMPANY_EN[t.company] || t.company) : t.company; }
function catOf(c) { return isEn() ? (CATEGORY_EN[c] || c) : c; }
function strengthsOf(t) { return isEn() && t.strengthsEn && t.strengthsEn.length ? t.strengthsEn : t.strengths; }
function limitOf(t) {
    if (!isEn()) return t.freeLimit;
    return t.freeLimitEn || DEFAULT_LIMIT_EN[t.pricing] || t.freeLimit;
}
function sortValueOf(t, key) {
    if (key === 'name') return nameOf(t);
    if (key === 'company') return companyOf(t);
    if (key === 'country') return countryOf(t);
    return t[key] || '';
}

// ---------- バッジ・ボタン ----------
function platformBadge(tool) {
    const pf = platformOf(tool);
    const icon = { both: '💻📱', pc: '💻', mobile: '📱' }[pf];
    return `<span class="pf-badge pf-${pf}"><span aria-hidden="true">${icon} </span><span class="sr-only">${T().pfPrefix}</span>${T().platform[pf]}</span>`;
}
function pricingBadge(tool) {
    const cls = { '完全無料': 'badge-free', '無料枠あり': 'badge-freemium', 'トライアルのみ': 'badge-trial' }[tool.pricing];
    const icon = { '完全無料': '✅', '無料枠あり': '🟢', 'トライアルのみ': '⚠️' }[tool.pricing];
    if (!cls) return '';
    return `<span class="badge ${cls}"><span aria-hidden="true">${icon} </span><span class="sr-only">${T().pricePrefix}</span>${esc(T().pricing(tool.pricing))}</span>`;
}
function jpBadge(tool) {
    const cls = { '◯': 'jp-o', '△': 'jp-a', '×': 'jp-x' }[tool.japanese];
    const label = T().jp[tool.japanese] || '';
    return `<span class="jp-badge ${cls}" title="${label}"><span aria-hidden="true">${tool.japanese}</span><span class="sr-only">${T().jpPrefix}${label}</span></span>`;
}
function extraBadges(tool) {
    return tool.noSignup ? `<span class="badge badge-nosign"><span aria-hidden="true">🚪 </span>${T().noSignup}</span>` : '';
}
function rankBadge(tool) {
    return tool.rank ? `<span class="rank-badge"><span aria-hidden="true">👑 </span><span class="sr-only">${T().rankSr}</span>${T().rank(tool.rank)}</span>` : '';
}
function favButton(tool) {
    const on = favorites.has(tool.name);
    return `<button type="button" class="fav-btn${on ? ' on' : ''}" data-fav="${esc(tool.name)}"
        aria-pressed="${on}" aria-label="${esc(T().fav(nameOf(tool)))}"
        title="${on ? T().favTitleOn : T().favTitleOff}"><span aria-hidden="true">${on ? '★' : '☆'}</span></button>`;
}
function strengthList(tool, extraClass = '') {
    return `<span class="sr-only">${T().strengthsSr}</span><ul class="strength-list ${extraClass}">${strengthsOf(tool).map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
}
function openLink(tool, cls = '') {
    return `<a ${cls ? `class="${cls}"` : ''} href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(T().openLabel(nameOf(tool)))}">${T().open} <span aria-hidden="true">→</span></a>`;
}

// ---------- 表の行・スマホのカード ----------
function createRow(tool) {
    const n = nameOf(tool);
    return `<tr>
        <td class="tool-name">
            ${tool.rank ? rankBadge(tool) + '<br>' : ''}
            <div class="name-line">${favButton(tool)}<button type="button" class="name-link" data-detail="${esc(tool.name)}" aria-haspopup="dialog">${esc(n)}</button></div>
            ${platformBadge(tool)}
        </td>
        <td class="tool-company col-company">${esc(companyOf(tool))}</td>
        <td class="tool-country">${esc(countryOf(tool))}</td>
        <td class="tool-jp col-jp">${jpBadge(tool)}</td>
        <td class="tool-category col-category"><div class="cat-tags">${tool.category.map(c => `<span class="cat-tag">${esc(catOf(c))}</span>`).join('')}</div></td>
        <td class="tool-strengths">${strengthList(tool)}</td>
        <td class="tool-free-limit">${pricingBadge(tool)} ${extraBadges(tool)}<br>${esc(limitOf(tool))}</td>
        <td class="tool-link">${openLink(tool)}</td>
    </tr>`;
}

function createCard(tool) {
    const n = nameOf(tool);
    return `<article class="tool-card">
        <div class="card-head">
            <div>
                ${rankBadge(tool)}
                <h3><button type="button" class="name-link" data-detail="${esc(tool.name)}" aria-haspopup="dialog">${esc(n)}</button></h3>
                <p class="card-meta">${esc(countryOf(tool))}　${T().japaneseWord} ${jpBadge(tool)}　${platformBadge(tool)}</p>
            </div>
            ${favButton(tool)}
        </div>
        <div class="card-badges">${pricingBadge(tool)} ${extraBadges(tool)}</div>
        ${strengthList(tool, 'card-strengths')}
        <p class="card-limit">${esc(limitOf(tool))}</p>
        <div class="card-actions">
            <button type="button" class="detail-btn" data-detail="${esc(tool.name)}" aria-haspopup="dialog" aria-label="${esc(T().detailLabel(n))}">${T().detail}</button>
            ${openLink(tool, 'open-btn')}
        </div>
    </article>`;
}

// ---------- 詳細ポップアップ ----------
const CATEGORY_TIPS_EN = {
    '画像作成': 'Whether you can use generated images commercially depends on the service. Check the terms before using them for work.',
    '動画作成': 'Free plans often add a watermark. Check the terms for commercial use as well.',
    '音楽・音声生成': 'Copyright and commercial use of generated songs and voices differ by service. Avoid imitating real people\'s voices.',
    '3Dモデル生成': 'Generated 3D models may have broken shapes. Check them in 3D software before using them in a game.',
    '開発者向けツール': 'These tools require programming knowledge. Beginners should start with "No-Code App Building".',
    'ノーコードでアプリ作成': 'Before publishing an app, check whether it handles any personal information.',
    '言語・翻訳': 'For important texts such as contracts, have a person check the translation too.',
    '医療・ヘルスケア': 'This is not a substitute for a doctor\'s diagnosis. See a medical professional if symptoms are serious or you are worried.',
    '悩み相談': 'AI can be a conversation partner but is not a professional. If you are struggling, please also reach out to people and support services.',
    'パーソナルアシスタント': 'Answers can be wrong. Check important information on official websites.',
    'Excel・事務作業': 'Before entering company data, check whether your workplace rules allow AI tools.',
    'タスクの自動化（RPA連携）': 'Test automations with sample data before running them on real data.'
};
const TOOL_NOTES_EN = {
    'Character.AI': 'Use by minors is restricted. See the official site for details.',
    'Midjourney': 'Paid plans are now the norm. Other image generators are recommended if you want to try for free.',
    'Digen AI': 'The developer\'s country is not yet confirmed.'
};

function openModal(name) {
    const tool = allTools.find(t => t.name === name);
    if (!tool) return;
    rememberFocus();
    const tipsMap = isEn() ? CATEGORY_TIPS_EN : CATEGORY_TIPS;
    const notes = isEn() ? TOOL_NOTES_EN : TOOL_NOTES;
    const tips = tool.category.filter(c => tipsMap[c]).map(c => `<li>${esc(tipsMap[c])}</li>`);
    if (notes[tool.name]) tips.unshift(`<li><strong>${esc(notes[tool.name])}</strong></li>`);
    if (tool.pricing === 'トライアルのみ') tips.unshift(`<li>${T().trialTip}</li>`);
    const d = T().dt;

    document.getElementById('modalBody').innerHTML = `
        ${tool.rank ? `<span class="rank-badge"><span aria-hidden="true">👑 </span>${T().rankModal(tool.rank)}</span>` : ''}
        <h2 id="modalTitle">${esc(nameOf(tool))}</h2>
        <div class="card-badges">${pricingBadge(tool)} ${extraBadges(tool)}</div>
        <dl class="detail-list">
            <dt>${d.company}</dt><dd>${esc(companyOf(tool))} (${esc(countryOf(tool))})</dd>
            <dt>${d.jp}</dt><dd>${jpBadge(tool)} ${T().jp[tool.japanese] || ''}</dd>
            <dt>${d.pf}</dt><dd>${platformBadge(tool)}</dd>
            <dt>${d.cats}</dt><dd>${tool.category.map(c => esc(catOf(c))).join(T().catSep)}</dd>
            <dt>${d.str}</dt><dd>${strengthList(tool)}</dd>
            <dt>${d.limit}</dt><dd>${esc(limitOf(tool))}</dd>
        </dl>
        ${tips.length ? `<h3>${T().tipsTitle}</h3><ul class="tips">${tips.join('')}</ul>` : ''}
        <div class="modal-actions">
            ${favButton(tool)}
            <a class="open-btn" href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${T().officialSite} <span aria-hidden="true">→</span><span class="sr-only">${T().newTab}</span></a>
        </div>`;
    document.getElementById('modal').hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('.modal-close').focus();
}

// ---------- 目的の説明（英語） ----------
const GUIDE_GROUP_EN = {
    '👑 特別な項目': '👑 Featured', '🤖 会話・調べもの': '🤖 Chat & Research', '💻 開発・プログラミング': '💻 Development & Programming',
    '🎨 画像・動画・音声': '🎨 Images, Video & Audio', '✍️ 文章・言葉': '✍️ Writing & Language', '📊 仕事・業務': '📊 Work & Business',
    '🏥 専門分野': '🏥 Specialized Fields'
};
const GUIDE_EN = {
    'よく使われるAIのTOP10': { short: 'The 10 AI tools people use most around the world. Start here if you are not sure what to try.', long: 'Selected based on Similarweb\'s global traffic ranking.' },
    '日本語特化': { short: 'AI made by Japanese companies or especially strong in Japanese.', long: 'For people who care about natural Japanese text and speech: reading aloud, transcription, proofreading and more.' },
    'パーソナルアシスタント': { short: 'So-called AI chat: ask for anything in conversation. The all-rounder when you do not have a specific goal.', long: 'Answers, writing, brainstorming, advice and more. If in doubt, start here.' },
    '情報検索・リサーチ': { short: 'AI that searches the web for current information and answers with source links.', long: 'Unlike ordinary chat AI, it looks things up on the spot. Sources are shown, so you can check whether the information is correct.' },
    '要約と構造化': { short: 'AI that shortens long text, PDFs or videos, or organizes them into headings and diagrams.', long: '"Organizing" means turning scattered information into headings, bullet points or mind maps. Saves reading time.' },
    '論文・リサーチ分析': { short: 'Specialized AI for finding and analyzing academic papers.', long: 'Focuses more on research evidence than general search AI. For students, researchers and healthcare professionals.' },
    '悩み相談': { short: 'AI that listens or helps you sort out your feelings. Not a substitute for a professional.', long: 'Talk casually or keep a mood diary. If you are struggling, please also reach out to people and support services.' },
    'ノーコードでアプリ作成': { short: 'Build apps and websites just by describing them, with no programming.', long: 'Ask "make an app like this" and the AI builds the screens and behavior. Start here if you are new to app building.' },
    '開発者向けツール': { short: 'Components and tools for programmers building AI systems.', long: 'Libraries, databases and AI models. Programming knowledge is required.',
        hint: 'New to programming? Try "No-Code App Building".' },
    'コード補完': { short: 'AI predicts and suggests the next code as you write.', long: 'Like predictive text for programming. It also fixes errors and explains code.' },
    'Android開発': { short: 'AI that helps build Android apps, with support for Android Studio and Kotlin.', long: 'AI built into Android Studio and no-code tools for making phone apps.' },
    'ゲーム開発': { short: 'AI for making characters, 3D assets, or whole games.', long: 'Asset generation, conversations with in-game characters, and tools that build games from chat.' },
    '画像作成': { short: 'AI that creates illustrations or photo-like images from scratch based on text.', long: 'So-called image generation AI. If you use images for work, check whether commercial use is allowed.',
        hint: 'Want to edit your own photos? Try "Image Editing".' },
    '画像編集': { short: 'AI that edits existing photos and images: background removal, object removal, upscaling and more.', long: 'Remove backgrounds, erase objects, or enlarge small images cleanly in seconds.',
        hint: 'Want to create images from scratch? Try "Image Generation".' },
    '3Dモデル生成': { short: 'AI that creates 3D data from text or images.', long: 'Useful for game assets, 3D printing and 3D on the web.' },
    '動画作成': { short: 'AI for generating footage, avatar videos where people speak, and editing your own videos.', long: 'Three types: generate footage from text or images, create talking-avatar videos, and make editing (like captions) easier.' },
    '音楽・音声生成': { short: 'AI that makes sound: songs, background music, reading text aloud and creating voices.', long: 'Some make songs or music, some read text aloud, and some extract vocals from a song.',
        hint: 'Want to turn speech into text? Try "Speech Recognition".' },
    '音声認識': { short: 'AI that turns speech into text (transcription). Useful for meeting notes and subtitles.', long: 'Create minutes from meeting recordings or add subtitles to videos. The opposite of speech generation.',
        hint: 'Want text read aloud? Try "Music & Voice Generation".' },
    'デザイン・UI/UX': { short: 'AI for logos, slides, flyers, app screens and other visual design.', long: 'UI is the look of screens and buttons; UX is ease of use and experience.' },
    'テキスト生成・AI執筆': { short: 'AI specialized in writing longer texts such as blog posts, ads and emails.', long: 'Includes tools for proofreading and rephrasing.' },
    '言語・翻訳': { short: 'AI that translates text, photos of signs, conversations and web pages.', long: 'For important texts such as contracts, have a person check the translation too.' },
    '学習・教育': { short: 'AI that helps you study: explaining solutions, memorizing words, practicing conversation.', long: 'Some show math steps, some help you keep learning languages, some score your pronunciation.' },
    'データ分析・予測': { short: 'AI that finds trends in numbers, makes charts and forecasts the future.', long: 'For example, forecasting next month from sales data.' },
    'Excel・事務作業': { short: 'AI that makes office work easier: Excel formulas, organizing tables, meeting notes.', long: 'Before entering company data, check whether your workplace rules allow AI tools.',
        hint: 'Want to connect several tasks into automation? Try "Task Automation (RPA)".' },
    'タスクの自動化（RPA連携）': { short: 'Lets software robots handle repetitive computer tasks for you.', long: 'Connect apps to automate work, like "when an email arrives, log it in Excel".' },
    '医療・ヘルスケア': { short: 'AI that suggests when to see a doctor based on symptoms, and AI for healthcare professionals.', long: 'Not a substitute for a doctor\'s diagnosis. Use it only as reference information.' },
    '製造・ロボティクス': { short: 'AI for factory inspection, robot simulation and object recognition.', long: 'Mostly specialized tools for engineers and researchers.' }
};
const CONFUSING_PAIRS_EN = [
    ['Image Generation / Image Editing', 'Create from scratch / Edit your own images'],
    ['Music & Voice Generation / Speech Recognition', 'Make sound from text / Turn speech into text'],
    ['Personal Assistant / Search & Research', 'Chat about anything / Search the web and answer with sources'],
    ['Search & Research / Academic Research', 'Search the whole web / Search academic papers only'],
    ['No-Code App Building / Developer Tools', 'Build just by describing / Requires programming'],
    ['Code Completion / Developer Tools', 'Helps you write code / Components for building AI systems'],
    ['Excel & Office Work / Task Automation (RPA)', 'Makes one task easier / Connects several tasks into automation']
];
function guideItem(i) {
    if (!isEn()) return i;
    const e = GUIDE_EN[i.cat] || {};
    return { ...i, short: e.short || i.short, long: e.long || i.long, hint: e.hint, label: CATEGORY_EN[i.cat] || i.cat,
             hintCatLabel: i.hintCat ? (CATEGORY_EN[i.hintCat] || i.hintCat) : '' };
}

function updateCategoryInfo(cats) {
    const box = document.getElementById('categoryInfo');
    if (!box) return;
    const list = cats.map(c => CATEGORY_MAP[c]).filter(Boolean).map(guideItem);
    if (!list.length) { box.hidden = true; box.innerHTML = ''; return; }
    const sep = isEn() ? ': ' : '：';
    box.innerHTML = list.map(i => `
        <div class="cat-info-item">
            <span class="cat-info-icon" aria-hidden="true">${i.icon}</span>
            <div>
                <strong>${esc(i.label || i.cat)}</strong>${sep}${esc(i.short)}
                ${i.hint && !cats.includes(i.hintCat)
                    ? `<br><span class="cat-info-hint">💡 ${esc(i.hint)}
                       <button type="button" class="link-btn" data-pick-cat="${esc(i.hintCat)}">${isEn() ? 'Show these too' : '追加で表示する'}</button></span>` : ''}
            </div>
        </div>`).join('') +
        `<p class="cat-info-more"><button type="button" class="link-btn" data-open-guide>📘 ${isEn() ? 'See all categories explained' : 'すべての目的の説明を見る'}</button></p>`;
    box.hidden = false;
}

function openCategoryGuide() {
    rememberFocus();
    const groups = CATEGORY_GUIDE.map(g => `
        <h3 class="guide-group">${isEn() ? (GUIDE_GROUP_EN[g.group] || g.group) : g.group}</h3>
        ${g.items.map(raw => {
            const i = guideItem(raw);
            const n = allTools.filter(t => t.category.includes(raw.cat)).length;
            return `<div class="guide-item">
                <div class="guide-item-head">
                    <h4>${i.icon} ${esc(i.label || i.cat)} <span class="count">(${n})</span></h4>
                    <button type="button" class="guide-pick" data-pick-cat="${esc(raw.cat)}" data-only>${isEn() ? 'Show these AI' : 'このAIを表示'}</button>
                </div>
                <p>${esc(i.short)}${isEn() ? ' ' : ''}${esc(i.long)}</p>
                <p class="guide-ex">${isEn() ? 'e.g. ' : '例：'}${esc(raw.ex)}</p>
            </div>`;
        }).join('')}`).join('');
    const pairs = (isEn() ? CONFUSING_PAIRS_EN : CONFUSING_PAIRS).map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');
    document.getElementById('modalBody').innerHTML = `
        <div class="guide">
            <h2 id="modalTitle">📘 ${isEn() ? 'Categories explained' : '目的の説明'}</h2>
            <p class="guide-lead">${isEn() ? 'Pick the category closest to what you want to do. "Show these AI" shows only that category.' : 'やりたいことに近い目的を選んでください。「このAIを表示」を押すと、その目的のAIだけを表示します。'}</p>
            <h3 class="guide-group">🤔 ${isEn() ? 'Easily confused categories' : '迷いやすい組み合わせ'}</h3>
            <div class="guide-table-wrap"><table class="guide-table"><tbody>${pairs}</tbody></table></div>
            ${groups}
        </div>`;
    document.getElementById('modal').hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('.modal-close').focus();
}

// ---------- ページの固定の文字を切り替える ----------
const ORIG = new WeakMap();   // 日本語の元の内容を覚えておく
function swapHTML(el, en) {
    if (!el) return;
    if (!ORIG.has(el)) ORIG.set(el, el.innerHTML);
    el.innerHTML = isEn() ? en : ORIG.get(el);
}
const ORIG_ATTR = new WeakMap();
function swapAttr(el, attr, en) {
    if (!el) return;
    if (!ORIG_ATTR.has(el)) ORIG_ATTR.set(el, {});
    const store = ORIG_ATTR.get(el);
    if (!(attr in store)) store[attr] = el.getAttribute(attr) || '';
    el.setAttribute(attr, isEn() ? en : store[attr]);
}
// ラベルの中の「文字の部分」だけを入れ替える（チェックボックスや件数はそのまま）
function textNodesOf(el) {
    return [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
}
function swapTextNodes(el, enParts) {
    if (!el) return;
    const nodes = textNodesOf(el).length ? textNodesOf(el) : [];
    if (!ORIG.has(el)) ORIG.set(el, nodes.map(n => n.textContent));
    const ja = ORIG.get(el);
    nodes.forEach((n, i) => { n.textContent = isEn() ? (enParts[i] !== undefined ? enParts[i] : '') : ja[i]; });
}
function labelOf(sel) { const i = document.querySelector(sel); return i ? i.closest('label') : null; }

const EN_TEXT = {
    title: 'Free AI Tools Finder | Compare 340+ AI tools by purpose',
    heroTitle: 'Free AI Tools<br class="sp-br"> Finder',
    heroSub: n => `Just pick what you want to do.<br class="sp-br"> Find your AI partner among <strong id="toolTotal">${n}</strong> tools.`,
    notices: {
        medical: '🏥 Medical and healthcare AI is for reference only. <strong>It is not a substitute for a doctor\'s diagnosis.</strong> Please see a medical professional if you are concerned about your health.',
        consult: '💬 AI can be a casual conversation partner, but if you are struggling, please also reach out to people and support services in your area.'
    },
    legend: `
        <p><strong>Devices:</strong> 💻 works in a PC browser or PC software / 📱 has an official app or works in a phone browser (approximate)</p>
        <p><strong>Japanese support:</strong> ◯ Japanese interface / △ interface in English etc., but works with Japanese input and output / × mainly English (approximate)</p>
        <p>* The "Top 10 Most-Used AI" is based on Similarweb's global traffic ranking as of July 2026.</p>
        <p>* Free usage and pricing can change at any time. Please check each official site before using it.</p>`,
    safety: `
        <h2>⚠️ Things to keep in mind when using AI</h2>
        <ul class="safety-list">
            <li><strong>Do not enter personal or confidential information</strong>: avoid entering names, addresses, phone numbers, passwords or company secrets. Some services use what you type to train their AI.</li>
            <li><strong>Be careful with copyright</strong>: even AI-generated text, images and music can raise copyright issues if they resemble existing works. Avoid imitating real works, characters or people's voices, and check each service's terms (commercial use) before using results for work.</li>
            <li><strong>Watch out for hallucinations</strong>: AI can state false information convincingly (this is called a hallucination). Always verify important information such as numbers, dates, names, laws and medical facts with official or trustworthy sources.</li>
        </ul>`,
    howto: `
        <h2>📖 How to use this site</h2>
        <ol class="howto-steps">
            <li><h3>Search by keyword</h3><p>Type in the search box at the top and results are filtered instantly. Besides AI names, you can search by country, company or what it does, such as "China", "Google", "subtitles" or "free".</p></li>
            <li><h3>Narrow down with filters</h3><p><strong>Price</strong> lets you show only completely free tools, or exclude trial-only tools. <strong>Japanese support</strong> shows only tools that work in Japanese. <strong>Devices</strong> lets you choose PC or phone. <strong>Other</strong> shows tools you can try without signing up, or only your favorites.</p></li>
            <li><h3>Choose by purpose</h3><p>Check what you want to do, such as "Image Generation", "Video Creation" or "Excel & Office Work". If you check several, tools that match any of them are shown. If unsure, start with "👑 Top 10 Most-Used AI". The number next to each item is how many tools match.</p></li>
            <li><h3>Sort</h3><p>Click the "AI", "Developer" or "Country" headings in the table to sort. Click again to reverse the order. On phones, use the "Sort" menu above the results.</p></li>
            <li><h3>See details and try it</h3><p>Click an AI's name to see what it can do and tips for using it. "Open →" opens the official site in a new tab.</p></li>
            <li><h3>Save favorites</h3><p>Click ☆ next to an AI's name to turn it into ★ and save it as a favorite. Favorites are stored in this browser, so they will still be there next time (they are not shared with other browsers or phones).</p></li>
            <li><h3>Save or share your filters</h3><p>"🔗 Copy link to these filters" copies your current filters as a URL. Bookmark it or send it to others. "Reset filters and sorting" returns everything to the start.</p></li>
            <li><h3>Switch the display size</h3><p>Use 📱 Phone, 📟 Tablet or 🖥️ PC at the top right to choose the easiest view. Your choice is remembered. In phone view, each AI is shown as a card.</p></li>
        </ol>
        <p class="howto-back"><a href="#top">▲ Back to top</a></p>`
};

function applyStaticText() {
    const en = isEn();
    document.documentElement.lang = en ? 'en' : 'ja';
    if (!ORIG.has(document)) ORIG.set(document, document.title);
    document.title = en ? EN_TEXT.title : ORIG.get(document);

    // 上部
    swapTextNodes(document.querySelector('.last-updated'), ['Last updated: ']);
    if (window._lastDate) document.getElementById('lastUpdated').textContent = T().date(window._lastDate);
    swapTextNodes(document.querySelector('.howto-link'), [' How to use this site']);
    [['mobile', 'Phone'], ['tablet', 'Tablet'], ['pc', 'PC']].forEach(([d, label]) => {
        const b = document.getElementById('btn-' + d);
        if (!b) return;
        const l = b.querySelector('.device-label');
        swapTextNodes(l, [label]);
        swapAttr(b, 'aria-label', `${label} view`);
    });
    swapAttr(document.querySelector('.device-switcher'), 'aria-label', 'Display size');

    // タイトル
    swapHTML(document.querySelector('.hero-title .marker'), EN_TEXT.heroTitle);
    const n = allTools.length || (document.getElementById('toolTotal') || {}).textContent || '';
    swapHTML(document.querySelector('.hero-sub'), EN_TEXT.heroSub(n));
    const tt = document.getElementById('toolTotal'); if (tt && allTools.length) tt.textContent = allTools.length;

    // 検索・絞り込み
    const input = document.getElementById('searchInput');
    swapAttr(input, 'placeholder', 'Search by country, company, category and more');
    swapAttr(input, 'aria-label', 'Keyword search');
    swapAttr(document.querySelector('.search-area'), 'aria-label', 'Search and filter AI tools');
    const titles = { '料金タイプ': 'Price', '日本語対応': 'Japanese support', '使う端末': 'Devices', 'その他': 'Other' };
    document.querySelectorAll('.filter-group .filter-title').forEach(h => {
        if (!ORIG.has(h)) ORIG.set(h, h.textContent);
        h.textContent = en ? (titles[ORIG.get(h).trim()] || ORIG.get(h)) : ORIG.get(h);
    });
    const radios = {
        'input[name="pricing"][value="all"]': 'All', 'input[name="pricing"][value="free"]': ' Completely free only',
        'input[name="pricing"][value="notrial"]': ' Exclude trial-only (free to keep using)',
        'input[name="japanese"][value="all"]': 'All', 'input[name="japanese"][value="o"]': '◯ Japanese interface',
        'input[name="japanese"][value="oa"]': '◯＋△ Usable in Japanese',
        'input[name="platform"][value="all"]': 'All', 'input[name="platform"][value="pc"]': ' Usable on PC',
        'input[name="platform"][value="mobile"]': ' Usable on phone', 'input[name="platform"][value="both"]': ' Usable on both phone and PC',
        '#noSignupFilter': ' Try without signing up'
    };
    Object.entries(radios).forEach(([sel, text]) => swapTextNodes(labelOf(sel), [' ' + text.trim()]));
    swapTextNodes(labelOf('#favFilter'), [' Show favorites only (', ')']);
    document.querySelectorAll('.category-filter').forEach(cb => {
        swapTextNodes(cb.closest('label'), [' ' + (CATEGORY_EN[cb.value] || cb.value) + ' ']);
    });
    swapAttr(document.querySelector('.filters'), 'aria-label', 'Filter by purpose (you can choose several)');
    swapTextNodes(document.querySelector('.summary-left'), ['Filter by purpose ']);
    swapTextNodes(document.getElementById('guideBtn'), [' Categories explained']);
    swapTextNodes(document.querySelector('.ai-warning'), [' Using AI safely: never enter personal data / respect copyright / answers may be wrong (hallucinations)']);
    swapTextNodes(document.getElementById('resetBtn'), ['Reset filters and sorting']);
    const share = document.getElementById('shareBtn'); if (share) share.textContent = T().share;

    // 注意書き・結果
    swapHTML(document.getElementById('notice-medical'), EN_TEXT.notices.medical);
    swapHTML(document.getElementById('notice-consult'), EN_TEXT.notices.consult +
        (document.querySelector('#notice-consult a') ? '' : ''));
    swapHTML(document.querySelector('.results-info p'), `Results: <span id="resultCount">0</span>`);
    swapAttr(document.querySelector('.results-area'), 'aria-label', 'Search results');
    const heads = { name: 'AI', company: 'Developer', country: 'Country' };
    document.querySelectorAll('.sortable').forEach(th => {
        const k = th.getAttribute('data-key');
        const btn = th.querySelector('.sort-btn');
        if (!btn) return;
        swapTextNodes(btn, [heads[k] + ' ']);
        swapAttr(btn, 'aria-label', `Sort by ${heads[k]}`);
    });
    [['.col-jp', 'Japanese'], ['th.col-category', 'Category'], ['th.col-strengths', 'Strengths'], ['th.col-limit', 'Free usage'], ['th.col-link', 'Link']]
        .forEach(([sel, text]) => {
            const th = document.querySelector('#resultsTable thead ' + (sel.startsWith('th') ? sel : 'th' + sel));
            if (!th) return;
            if (!ORIG.has(th)) ORIG.set(th, th.textContent);
            th.textContent = en ? text : ORIG.get(th);
        });
    const cap = document.querySelector('#resultsTable caption');
    if (cap) { if (!ORIG.has(cap)) ORIG.set(cap, cap.textContent); cap.textContent = en ? 'List of AI tools (sort by AI, developer or country)' : ORIG.get(cap); }
    swapTextNodes(document.querySelector('label[for="mobileSort"]'), ['Sort: ']);
    const opts = document.querySelectorAll('#mobileSort option');
    ['Default', 'AI name (A→Z)', 'AI name (Z→A)', 'By country'].forEach((t, i) => {
        const o = opts[i]; if (!o) return;
        if (!ORIG.has(o)) ORIG.set(o, o.textContent);
        o.textContent = en ? t : ORIG.get(o);
    });
    swapHTML(document.querySelector('#noResults p') || document.getElementById('noResults'),
        'No AI tools match these conditions. Uncheck some filters or press "Reset filters and sorting".');
    swapHTML(document.querySelector('.legend'), EN_TEXT.legend);

    // 下部
    swapHTML(document.getElementById('safety'), EN_TEXT.safety);
    const fb = document.querySelector('.feedback');
    if (fb) {
        swapHTML(fb.querySelector('h2'), '📮 Report errors / request an AI');
        swapHTML(fb.querySelector('p'), 'Found a broken link or wrong information, or want an AI added? Let us know here.');
        swapHTML(fb.querySelector('a'), 'Send a report or request');
    }
    swapHTML(document.getElementById('howto'), EN_TEXT.howto);
    swapHTML(document.querySelector('footer p'), '© 2026 Free AI Tools Finder');
    const skip = document.querySelector('.skip-link');
    if (skip) { if (!ORIG.has(skip)) ORIG.set(skip, skip.textContent); skip.textContent = en ? 'Skip to results' : ORIG.get(skip); }
    swapAttr(document.querySelector('.modal-close'), 'aria-label', 'Close');

    // 切り替えボタンの状態
    document.querySelectorAll('.lang-btn').forEach(b => {
        const on = b.dataset.lang === LANG;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
    });
}

function setLang(lang) {
    if (lang === LANG) return;
    LANG = lang;
    try { localStorage.setItem('lang', lang); } catch (e) {}
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) {
        if (lang === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
        history.replaceState(null, '', url);
    }
    closeModal();
    applyStaticText();
    updateFilterCounts();
    if (allTools.length) filterTools();
}

function setupLanguageSwitch() {
    const wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language / 言語');
    wrap.innerHTML = `
        <span class="lang-icon" aria-hidden="true">🌐</span>
        <button type="button" class="lang-btn" data-lang="ja" lang="ja">日本語</button>
        <button type="button" class="lang-btn" data-lang="en" lang="en">English</button>`;
    const right = document.querySelector('.top-right') || document.querySelector('.top-bar');
    if (right) right.insertBefore(wrap, right.firstChild);
    wrap.addEventListener('click', e => {
        const b = e.target.closest('.lang-btn');
        if (b) setLang(b.dataset.lang);
    });
    applyStaticText();
}

document.addEventListener('DOMContentLoaded', setupLanguageSwitch);
