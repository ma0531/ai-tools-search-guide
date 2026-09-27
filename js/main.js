// ==========================================
// データ・状態管理
// ==========================================
let allTools = [];
let currentSort = { key: null, direction: 'asc' };

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    injectDeviceSwitcher();   // デバイス切り替えボタンを挿入
    detectDevice();           // デバイス自動判別
    loadTools();              // データ読み込み
    setupEventListeners();    // イベント登録
});

// ==========================================
// デバイス切り替えボタンをページに追加
// ==========================================
function injectDeviceSwitcher() {
    const switcher = document.createElement('div');
    switcher.className = 'device-switcher';
    switcher.innerHTML = `
        <button class="device-btn" id="btn-mobile" onclick="setView('mobile')" title="スマホ表示">
            📱<span class="device-label">スマホ</span>
        </button>
        <button class="device-btn" id="btn-tablet" onclick="setView('tablet')" title="タブレット表示">
            📟<span class="device-label">タブレット</span>
        </button>
        <button class="device-btn" id="btn-pc" onclick="setView('pc')" title="PC表示">
            🖥️<span class="device-label">PC</span>
        </button>
    `;
    document.body.appendChild(switcher);
}

// ==========================================
// デバイス自動判別
// ==========================================
function detectDevice() {
    const ua = navigator.userAgent;
    const w  = window.innerWidth;

    // ローカルストレージに保存済みの設定があれば優先する
    try {
        const saved = localStorage.getItem('preferredView');
        if (saved) {
            setView(saved);
            return;
        }
    } catch(e) {}

    let device = 'pc';

    // スマホ判定：UAにスマホキーワードがある、または幅600px以下
    if (/Mobi|Android|iPhone|iPod/i.test(ua) && w <= 820) {
        device = 'mobile';
    // タブレット判定：UAにiPad/Tabletがある場合のみ（幅だけでは判定しない）
    } else if (/iPad|Tablet/i.test(ua)) {
        device = 'tablet';
    // それ以外はすべてPC
    } else {
        device = 'pc';
    }
    
    setView(device);
}

// ==========================================
// 表示モードを切り替える
// ==========================================
function setView(device) {
    // bodyのクラスを切り替え
    document.body.classList.remove('view-mobile', 'view-tablet', 'view-pc');
    document.body.classList.add('view-' + device);

    // ボタンのアクティブ状態を更新
    ['mobile', 'tablet', 'pc'].forEach(d => {
        const btn = document.getElementById('btn-' + d);
        if (btn) btn.classList.toggle('active', d === device);
    });

    // ローカルストレージに保存（次回アクセス時に引き継ぐ）
    try { localStorage.setItem('preferredView', device); } catch(e) {}
}

// ==========================================
// JSONからデータ読み込み
// ==========================================
function loadTools() {
    // ローカルストレージに好みの表示モードがあれば復元
    try {
        const saved = localStorage.getItem('preferredView');
        if (saved) setView(saved);
    } catch(e) {}

    fetch('data/ai-tools.json')
        .then(r => r.json())
        .then(data => {
            allTools = data.tools;
            renderTable(getFilteredAndSortedTools());
        })
        .catch(err => {
            console.error('データ読み込みエラー:', err);
            document.getElementById('tableBody').innerHTML =
                '<tr><td colspan="7">データの読み込みに失敗しました</td></tr>';
        });
}

// ==========================================
// イベントリスナー
// ==========================================
function setupEventListeners() {
    document.getElementById('searchInput')
        .addEventListener('input', filterTools);

    document.querySelectorAll('.category-filter')
        .forEach(cb => cb.addEventListener('change', filterTools));

    document.getElementById('resetBtn')
        .addEventListener('click', resetFilters);

    document.querySelectorAll('.sortable')
        .forEach(th => th.addEventListener('click', function () {
            sortTools(this.getAttribute('data-key'));
        }));
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
// フィルタ＋ソートを適用
// ==========================================
function getFilteredAndSortedTools() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const cats = Array.from(document.querySelectorAll('.category-filter:checked'))
                      .map(cb => cb.value);

    let result = allTools.filter(tool => {
        const matchSearch =
            tool.name.toLowerCase().includes(term) ||
            tool.company.toLowerCase().includes(term) ||
            tool.country.toLowerCase().includes(term) ||
            tool.strengths.some(s => s.toLowerCase().includes(term)) ||
            tool.category.some(c => c.toLowerCase().includes(term)) ||
            tool.freeLimit.toLowerCase().includes(term);

        const matchCat = cats.length === 0 ||
            cats.some(c => tool.category.includes(c));

        return matchSearch && matchCat;
    });

    if (currentSort.key) {
        result = result.slice().sort((a, b) => {
            const va = (a[currentSort.key] || '').toLowerCase();
            const vb = (b[currentSort.key] || '').toLowerCase();
            if (va < vb) return currentSort.direction === 'asc' ? -1 : 1;
            if (va > vb) return currentSort.direction === 'asc' ?  1 : -1;
            return 0;
        });
    }
    return result;
}

// ==========================================
// テーブル描画
// ==========================================
function filterTools() {
    renderTable(getFilteredAndSortedTools());
}

function renderTable(tools) {
    const tbody    = document.getElementById('tableBody');
    const noResult = document.getElementById('noResults');

    tbody.innerHTML = '';

    if (tools.length === 0) {
        noResult.style.display = 'block';
        document.getElementById('resultCount').textContent = '0';
        return;
    }

    tools.forEach(tool => tbody.appendChild(createToolRow(tool)));
    noResult.style.display = 'none';
    document.getElementById('resultCount').textContent = tools.length;
}

function createToolRow(tool) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="tool-name"><strong>${tool.name}</strong></td>
        <td class="tool-company col-company">${tool.company}</td>
        <td class="tool-country">${tool.country}</td>
        <td class="tool-category col-category">${tool.category.join(', ')}</td>
        <td class="tool-strengths">${tool.strengths.join(', ')}</td>
        <td class="tool-free-limit">${tool.freeLimit}</td>
        <td class="tool-link">
            <a href="${tool.url}" target="_blank" rel="noopener noreferrer">開く →</a>
        </td>
    `;
    return row;
}

// ==========================================
// リセット
// ==========================================
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.category-filter')
        .forEach(cb => cb.checked = false);

    currentSort = { key: null, direction: 'asc' };
    document.querySelectorAll('.sortable').forEach(th => {
        th.querySelector('.sort-icon').textContent = '⇅';
        th.classList.remove('sorted');
    });

    renderTable(getFilteredAndSortedTools());
}
