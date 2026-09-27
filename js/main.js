// ==========================================
// データ・状態管理
// ==========================================
let allTools = [];
let currentSort = { key: null, direction: 'asc' };

const PRICING_BADGE = {
    '完全無料':     '<span class="badge badge-free">✅ 完全無料</span>',
    '無料枠あり':   '<span class="badge badge-freemium">🟢 無料枠あり</span>',
    'トライアルのみ': '<span class="badge badge-trial">⚠️ トライアルのみ</span>'
};

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    injectDeviceSwitcher();
    showLastUpdated();
    detectDevice();
    loadTools();
    setupEventListeners();
});

// ==========================================
// デバイス切り替えボタン（右上）
// ==========================================
function injectDeviceSwitcher() {
    ['mobile', 'tablet', 'pc'].forEach(d => {
        const btn = document.getElementById('btn-' + d);
        if (btn) btn.addEventListener('click', () => setView(d));
    });
}

// ==========================================
// デバイス自動判別
// ==========================================
function detectDevice() {
    try {
        const saved = localStorage.getItem('preferredView');
        if (saved) { setView(saved); return; }
    } catch (e) {}

    const ua = navigator.userAgent;
    const w  = window.innerWidth;
    let device = 'pc';
    if (/Mobi|Android|iPhone|iPod/i.test(ua) && w <= 820) {
        device = 'mobile';
    } else if (/iPad|Tablet/i.test(ua)) {
        device = 'tablet';
    }
    setView(device, false);
}

function setView(device, save = true) {
    document.body.classList.remove('view-mobile', 'view-tablet', 'view-pc');
    document.body.classList.add('view-' + device);
    ['mobile', 'tablet', 'pc'].forEach(d => {
        const btn = document.getElementById('btn-' + d);
        if (btn) btn.classList.toggle('active', d === device);
    });
    if (save) {
        try { localStorage.setItem('preferredView', device); } catch (e) {}
    }
}

// ==========================================
// 最終更新日（GitHubの最新コミット日を自動取得）
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

    if (!location.hostname.endsWith('github.io') || !repo) {
        setTimeout(fallback, 800);
        return;
    }
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(list => {
            const date = list[0].commit.committer.date;
            el.textContent = formatDate(new Date(date));
        })
        .catch(() => setTimeout(fallback, 800));
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
            updateFilterCounts();
            filterTools();
        })
        .catch(err => {
            console.error('データ読み込みエラー:', err);
            document.getElementById('tableBody').innerHTML =
                '<tr><td colspan="7">データの読み込みに失敗しました</td></tr>';
        });
}

// 各カテゴリの件数を表示し、0件の項目は自動で隠す
function updateFilterCounts() {
    document.querySelectorAll('.category-filter').forEach(cb => {
        const n = allTools.filter(t => t.category.includes(cb.value)).length;
        const label = cb.parentElement;
        let span = label.querySelector('.count');
        if (!span) {
            span = document.createElement('span');
            span.className = 'count';
            label.appendChild(span);
        }
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
    document.querySelectorAll('input[name="pricing"]').forEach(r => r.addEventListener('change', filterTools));
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    document.querySelectorAll('.sortable').forEach(th =>
        th.addEventListener('click', function () { sortTools(this.getAttribute('data-key')); }));
}

// ==========================================
// ソート
// ==========================================
function sortTools(key) {
    if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
    }
    document.querySelectorAll('.sortable').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (th.getAttribute('data-key') === key) {
            icon.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
            th.classList.add('sorted');
        } else {
            icon.textContent = '⇅';
            th.classList.remove('sorted');
        }
    });
    filterTools();
}

// ==========================================
// 絞り込み（目的はOR、料金タイプはAND）
// ==========================================
function getFilteredAndSortedTools() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const cats = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
    const pricingMode = document.querySelector('input[name="pricing"]:checked').value;

    let result = allTools.filter(tool => {
        const matchSearch =
            tool.name.toLowerCase().includes(term) ||
            tool.company.toLowerCase().includes(term) ||
            tool.country.toLowerCase().includes(term) ||
            tool.pricing.toLowerCase().includes(term) ||
            tool.strengths.some(s => s.toLowerCase().includes(term)) ||
            tool.category.some(c => c.toLowerCase().includes(term)) ||
            tool.freeLimit.toLowerCase().includes(term);

        const matchCat = cats.length === 0 || cats.some(c => tool.category.includes(c));

        let matchPricing = true;
        if (pricingMode === 'free')    matchPricing = tool.pricing === '完全無料';
        if (pricingMode === 'notrial') matchPricing = tool.pricing !== 'トライアルのみ';

        return matchSearch && matchCat && matchPricing;
    });

    // TOP10を選んでいて並び替え未指定なら順位順に
    if (!currentSort.key && cats.includes('よく使われるAIのTOP10')) {
        result = result.slice().sort((a, b) => (a.rank || 999) - (b.rank || 999));
    }

    if (currentSort.key) {
        result = result.slice().sort((a, b) => {
            const va = (a[currentSort.key] || '').toLowerCase();
            const vb = (b[currentSort.key] || '').toLowerCase();
            const cmp = va.localeCompare(vb, 'ja');
            return currentSort.direction === 'asc' ? cmp : -cmp;
        });
    }
    return result;
}

// ==========================================
// 表示
// ==========================================
function filterTools() {
    renderTable(getFilteredAndSortedTools());
}

function renderTable(tools) {
    const tbody = document.getElementById('tableBody');
    const noResult = document.getElementById('noResults');
    tbody.innerHTML = '';
    document.getElementById('resultCount').textContent = tools.length;

    if (tools.length === 0) {
        noResult.style.display = 'block';
        return;
    }
    noResult.style.display = 'none';
    tools.forEach(tool => tbody.appendChild(createToolRow(tool)));
}

function createToolRow(tool) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="tool-name">${tool.rank ? `<span class="rank-badge">👑 ${tool.rank}位</span><br>` : ''}<strong>${tool.name}</strong></td>
        <td class="tool-company col-company">${tool.company}</td>
        <td class="tool-country">${tool.country}</td>
        <td class="tool-category col-category">${tool.category.join(', ')}</td>
        <td class="tool-strengths">${tool.strengths.join(', ')}</td>
        <td class="tool-free-limit">${PRICING_BADGE[tool.pricing] || ''}<br>${tool.freeLimit}</td>
        <td class="tool-link"><a href="${tool.url}" target="_blank" rel="noopener noreferrer">開く →</a></td>
    `;
    return row;
}

// ==========================================
// リセット
// ==========================================
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
    document.querySelector('input[name="pricing"][value="all"]').checked = true;

    currentSort = { key: null, direction: 'asc' };
    document.querySelectorAll('.sortable').forEach(th => {
        th.querySelector('.sort-icon').textContent = '⇅';
        th.classList.remove('sorted');
    });
    filterTools();
}
