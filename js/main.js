// AIツールデータを格納する変数
let allTools = [];
let currentSort = { key: null, direction: 'asc' };

// ページが読み込まれたときに実行
document.addEventListener('DOMContentLoaded', function() {
    loadTools();
    setupEventListeners();
});

// JSONファイルからAIツール情報を読み込む
function loadTools() {
    fetch('data/ai-tools.json')
        .then(response => response.json())
        .then(data => {
            allTools = data.tools;
            displayAllTools();
        })
        .catch(error => {
            console.error('データ読み込みエラー:', error);
            document.getElementById('tableBody').innerHTML =
                '<tr><td colspan="7">データの読み込みに失敗しました</td></tr>';
        });
}

// イベントリスナーを設定
function setupEventListeners() {
    // キーワード検索
    document.getElementById('searchInput').addEventListener('input', filterTools);

    // カテゴリチェックボックス
    document.querySelectorAll('.category-filter').forEach(checkbox => {
        checkbox.addEventListener('change', filterTools);
    });

    // リセットボタン
    document.getElementById('resetBtn').addEventListener('click', resetFilters);

    // ソートボタン（ヘッダークリック）
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const key = this.getAttribute('data-key');
            sortTools(key);
        });
    });
}

// ソート処理
function sortTools(key) {
    // 同じキーなら方向を反転、違うキーなら昇順にリセット
    if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
    }

    // ソートアイコンを更新
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

    // 現在の表示を再フィルタ＆ソートして表示
    filterTools();
}

// フィルタ＋ソートを適用してツールを取得
function getFilteredAndSortedTools() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const selectedCategories = Array.from(
        document.querySelectorAll('.category-filter:checked')
    ).map(cb => cb.value);

    // フィルタリング
    let result = allTools.filter(tool => {
        const matchesSearch =
            tool.name.toLowerCase().includes(searchTerm) ||
            tool.company.toLowerCase().includes(searchTerm) ||
            tool.country.toLowerCase().includes(searchTerm) ||
            tool.strengths.some(s => s.toLowerCase().includes(searchTerm)) ||
            tool.category.some(c => c.toLowerCase().includes(searchTerm)) ||
            tool.freeLimit.toLowerCase().includes(searchTerm);

        const matchesCategory = selectedCategories.length === 0 ||
            selectedCategories.some(cat => tool.category.includes(cat));

        return matchesSearch && matchesCategory;
    });

    // ソート
    if (currentSort.key) {
        result = result.slice().sort((a, b) => {
            const valA = (a[currentSort.key] || '').toLowerCase();
            const valB = (b[currentSort.key] || '').toLowerCase();
            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return result;
}

// 全ツールを表示
function displayAllTools() {
    const tools = getFilteredAndSortedTools();
    renderTable(tools);
}

// 検索・フィルタ機能
function filterTools() {
    const tools = getFilteredAndSortedTools();
    renderTable(tools);
}

// テーブルに結果を描画
function renderTable(tools) {
    const tableBody = document.getElementById('tableBody');
    const noResults = document.getElementById('noResults');

    tableBody.innerHTML = '';

    if (tools.length === 0) {
        noResults.style.display = 'block';
        document.getElementById('resultCount').textContent = '0';
        return;
    }

    tools.forEach(tool => {
        const row = createToolRow(tool);
        tableBody.appendChild(row);
    });

    noResults.style.display = 'none';
    document.getElementById('resultCount').textContent = tools.length;
}

// ツール行を作成する関数
function createToolRow(tool) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="tool-name"><strong>${tool.name}</strong></td>
        <td class="tool-company">${tool.company}</td>
        <td class="tool-country">${tool.country}</td>
        <td class="tool-category">${tool.category.join(', ')}</td>
        <td class="tool-strengths">${tool.strengths.join(', ')}</td>
        <td class="tool-free-limit">${tool.freeLimit}</td>
        <td class="tool-link"><a href="${tool.url}" target="_blank" rel="noopener noreferrer">開く →</a></td>
    `;
    return row;
}

// フィルタをリセット
function resetFilters() {
    document.getElementById('searchInput').value = '';

    document.querySelectorAll('.category-filter').forEach(checkbox => {
        checkbox.checked = false;
    });

    // ソートもリセット
    currentSort = { key: null, direction: 'asc' };
    document.querySelectorAll('.sortable').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        icon.textContent = '⇅';
        th.classList.remove('sorted');
    });

    displayAllTools();
}
