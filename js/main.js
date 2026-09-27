// AIツールデータを格納する変数
let allTools = [];

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
                '<tr><td colspan="5">データの読み込みに失敗しました</td></tr>';
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
}

// 全ツールを表示
function displayAllTools() {
    const tableBody = document.getElementById('tableBody');
    const noResults = document.getElementById('noResults');
    
    tableBody.innerHTML = '';
    
    if (allTools.length === 0) {
        noResults.style.display = 'block';
        document.getElementById('resultCount').textContent = '0';
        return;
    }
    
    allTools.forEach(tool => {
        const row = createToolRow(tool);
        tableBody.appendChild(row);
    });
    
    noResults.style.display = 'none';
    document.getElementById('resultCount').textContent = allTools.length;
}

// ツール行を作成する関数
function createToolRow(tool) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="tool-name"><strong>${tool.name}</strong></td>
        <td class="tool-category">${tool.category.join(', ')}</td>
        <td class="tool-strengths">${tool.strengths.join(', ')}</td>
        <td class="tool-free-limit">${tool.freeLimit}</td>
        <td class="tool-link"><a href="${tool.url}" target="_blank" rel="noopener noreferrer">開く →</a></td>
    `;
    return row;
}

// 検索・フィルタ機能
function filterTools() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // チェックされたカテゴリを取得
    const selectedCategories = Array.from(
        document.querySelectorAll('.category-filter:checked')
    ).map(cb => cb.value);

    // フィルタリング処理
    const filtered = allTools.filter(tool => {
        // キーワード検索（ツール名、強み、カテゴリから検索）
        const matchesSearch = 
            tool.name.toLowerCase().includes(searchTerm) ||
            tool.strengths.some(s => s.toLowerCase().includes(searchTerm)) ||
            tool.category.some(c => c.toLowerCase().includes(searchTerm)) ||
            tool.freeLimit.toLowerCase().includes(searchTerm);
        
        // カテゴリフィルタ
        const matchesCategory = selectedCategories.length === 0 ||
                               selectedCategories.some(cat => tool.category.includes(cat));
        
        return matchesSearch && matchesCategory;
    });

    // フィルタ結果を表示
    displayFilteredTools(filtered);
}

// フィルタ結果を表示
function displayFilteredTools(filtered) {
    const tableBody = document.getElementById('tableBody');
    const noResults = document.getElementById('noResults');
    
    tableBody.innerHTML = '';
    
    if (filtered.length === 0) {
        noResults.style.display = 'block';
        document.getElementById('resultCount').textContent = '0';
        return;
    }
    
    filtered.forEach(tool => {
        const row = createToolRow(tool);
        tableBody.appendChild(row);
    });
    
    noResults.style.display = 'none';
    document.getElementById('resultCount').textContent = filtered.length;
}

// フィルタをリセット
function resetFilters() {
    // 検索ボックスをクリア
    document.getElementById('searchInput').value = '';
    
    // すべてのチェックボックスをオフ
    document.querySelectorAll('.category-filter').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // 全ツールを表示
    displayAllTools();
}
