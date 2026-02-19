// API Configuration
const API_BASE = 'https://api.coingecko.com/api/v3';
let currentPage = 1;
let currentCurrency = 'inr';
let currentTab = 'all';
let allCoins = [];
let watchlist = JSON.parse(localStorage.getItem('cryptoWatchlist')) || [];
let searchQuery = '';
let isLoading = false;

// Currency Symbols
const currencySymbols = {
    usd: '$',
    eur: '€',
    gbp: '£',
    inr: '₹'
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    fetchGlobalData();
    fetchCryptoData();
    startAutoRefresh();
});

// Event Listeners
function initializeEventListeners() {
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('currencySelect').addEventListener('change', handleCurrencyChange);
    document.getElementById('refreshBtn').addEventListener('click', handleRefresh);
    document.getElementById('prevBtn').addEventListener('click', () => changePage(-1));
    document.getElementById('nextBtn').addEventListener('click', () => changePage(1));
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleTabChange(e.target.dataset.tab));
    });

    // Modal close
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeModal();
    });
}

// Fetch Global Market Data
async function fetchGlobalData() {
    try {
        const response = await fetch(`${API_BASE}/global`);
        const data = await response.json();
        const global = data.data;

        document.getElementById('totalMarketCap').textContent = 
            formatCurrency(global.total_market_cap[currentCurrency], currentCurrency);
        document.getElementById('totalVolume').textContent = 
            formatCurrency(global.total_volume[currentCurrency], currentCurrency);
        document.getElementById('btcDominance').textContent = 
            global.market_cap_percentage.btc.toFixed(2) + '%';
    } catch (error) {
        console.error('Error fetching global data:', error);
    }
}

// Fetch Cryptocurrency Data
async function fetchCryptoData() {
    if (isLoading) return;
    isLoading = true;
    showLoading();
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        
        let url = `${API_BASE}/coins/markets?vs_currency=${currentCurrency}&order=market_cap_desc&per_page=20&page=${currentPage}&sparkline=false&price_change_percentage=24h`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allCoins = await response.json();
        
        displayCryptos();
        updateLastUpdate();
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        document.getElementById('cryptoContainer').innerHTML = 
            '<div class="loading">Unable to load data. Please check your internet connection and try again.</div>';
    } finally {
        isLoading = false;
    }
}

// Display Cryptocurrencies
function displayCryptos() {
    let coinsToDisplay = allCoins;

    // Filter based on current tab
    if (currentTab === 'watchlist') {
        coinsToDisplay = allCoins.filter(coin => watchlist.includes(coin.id));
    } else if (currentTab === 'trending') {
        coinsToDisplay = allCoins.filter(coin => 
            Math.abs(coin.price_change_percentage_24h) > 5
        );
    }

    // Apply search filter
    if (searchQuery) {
        coinsToDisplay = coinsToDisplay.filter(coin =>
            coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    const container = document.getElementById('cryptoContainer');
    
    if (coinsToDisplay.length === 0) {
        container.innerHTML = '<div class="loading">No cryptocurrencies found.</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'crypto-grid';

    coinsToDisplay.forEach(coin => {
        const card = createCryptoCard(coin);
        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

// Create Crypto Card
function createCryptoCard(coin) {
    const card = document.createElement('div');
    card.className = 'crypto-card';
    
    const isPositive = coin.price_change_percentage_24h >= 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    const changeSymbol = isPositive ? '▲' : '▼';
    const isInWatchlist = watchlist.includes(coin.id);

    card.innerHTML = `
        <button class="watchlist-btn" onclick="toggleWatchlist('${coin.id}', event)">
            ${isInWatchlist ? '⭐' : '☆'}
        </button>
        <div class="crypto-header">
            <img src="${coin.image}" alt="${coin.name}" class="crypto-icon">
            <div class="crypto-info">
                <h3>${coin.name}</h3>
                <span class="crypto-symbol">${coin.symbol}</span>
            </div>
        </div>
        <div class="crypto-price">
            ${formatCurrency(coin.current_price, currentCurrency)}
        </div>
        <div class="crypto-change ${changeClass}">
            ${changeSymbol} ${Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
        </div>
        <div class="crypto-details">
            <div class="detail-row">
                <span>Market Cap:</span>
                <strong>${formatLargeNumber(coin.market_cap)}</strong>
            </div>
            <div class="detail-row">
                <span>Volume (24h):</span>
                <strong>${formatLargeNumber(coin.total_volume)}</strong>
            </div>
            <div class="detail-row">
                <span>High (24h):</span>
                <strong>${formatCurrency(coin.high_24h, currentCurrency)}</strong>
            </div>
            <div class="detail-row">
                <span>Low (24h):</span>
                <strong>${formatCurrency(coin.low_24h, currentCurrency)}</strong>
            </div>
        </div>
    `;

    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('watchlist-btn')) {
            showCoinDetails(coin.id);
        }
    });

    return card;
}

// Show Coin Details Modal
async function showCoinDetails(coinId) {
    const modal = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading">Loading details...</div>';
    modal.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`);
        const coin = await response.json();

        modalBody.innerHTML = `
            <div class="modal-header">
                <img src="${coin.image.large}" alt="${coin.name}" class="modal-icon">
                <div class="modal-title">
                    <h2>${coin.name}</h2>
                    <div class="modal-subtitle">${coin.symbol.toUpperCase()} • Rank #${coin.market_cap_rank || 'N/A'}</div>
                </div>
            </div>
            <div class="crypto-price" style="text-align: center; margin: 20px 0;">
                ${formatCurrency(coin.market_data.current_price[currentCurrency], currentCurrency)}
            </div>
            <div class="crypto-change ${coin.market_data.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}" 
                 style="text-align: center; margin-bottom: 20px;">
                ${coin.market_data.price_change_percentage_24h >= 0 ? '▲' : '▼'} 
                ${Math.abs(coin.market_data.price_change_percentage_24h).toFixed(2)}% (24h)
            </div>
            <div class="modal-stats">
                <div class="modal-stat">
                    <div class="modal-stat-label">Market Cap</div>
                    <div class="modal-stat-value">${formatLargeNumber(coin.market_data.market_cap[currentCurrency])}</div>
                </div>
                <div class="modal-stat">
                    <div class="modal-stat-label">24h Volume</div>
                    <div class="modal-stat-value">${formatLargeNumber(coin.market_data.total_volume[currentCurrency])}</div>
                </div>
                <div class="modal-stat">
                    <div class="modal-stat-label">Circulating Supply</div>
                    <div class="modal-stat-value">${formatLargeNumber(coin.market_data.circulating_supply)}</div>
                </div>
                <div class="modal-stat">
                    <div class="modal-stat-label">Total Supply</div>
                    <div class="modal-stat-value">${coin.market_data.total_supply ? formatLargeNumber(coin.market_data.total_supply) : 'N/A'}</div>
                </div>
                <div class="modal-stat">
                    <div class="modal-stat-label">All-Time High</div>
                    <div class="modal-stat-value">${formatCurrency(coin.market_data.ath[currentCurrency], currentCurrency)}</div>
                </div>
                <div class="modal-stat">
                    <div class="modal-stat-label">All-Time Low</div>
                    <div class="modal-stat-value">${formatCurrency(coin.market_data.atl[currentCurrency], currentCurrency)}</div>
                </div>
            </div>
        `;
    } catch (error) {
        modalBody.innerHTML = '<div class="loading">Error loading details.</div>';
    }
}

// Close Modal
function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// Toggle Watchlist
function toggleWatchlist(coinId, event) {
    event.stopPropagation();
    
    const index = watchlist.indexOf(coinId);
    if (index > -1) {
        watchlist.splice(index, 1);
    } else {
        watchlist.push(coinId);
    }
    
    localStorage.setItem('cryptoWatchlist', JSON.stringify(watchlist));
    displayCryptos();
}

// Handle Search
function handleSearch(e) {
    searchQuery = e.target.value;
    displayCryptos();
}

// Handle Currency Change
function handleCurrencyChange(e) {
    currentCurrency = e.target.value;
    currentPage = 1;
    fetchGlobalData();
    fetchCryptoData();
}

// Handle Tab Change
function handleTabChange(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    displayCryptos();
}

// Handle Refresh
function handleRefresh() {
    fetchGlobalData();
    fetchCryptoData();
}

// Change Page
function changePage(direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage}`;
    
    fetchCryptoData();
}

// Auto Refresh (every 60 seconds)
function startAutoRefresh() {
    setInterval(() => {
        fetchGlobalData();
        fetchCryptoData();
    }, 60000);
}

// Update Last Update Time
function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('lastUpdate').textContent = `Last updated: ${timeString}`;
}

// Show Loading
function showLoading() {
    document.getElementById('cryptoContainer').innerHTML = 
        '<div class="loading">Loading cryptocurrencies...</div>';
}

// Format Currency
function formatCurrency(value, currency) {
    if (!value) return 'N/A';
    const symbol = currencySymbols[currency] || '$';
    
    // Special formatting for INR to show reasonable amounts
    if (currency === 'inr') {
        if (value >= 10000000) { // 1 crore
            return `${symbol}${(value / 10000000).toFixed(2)}Cr`;
        } else if (value >= 100000) { // 1 lakh
            return `${symbol}${(value / 100000).toFixed(2)}L`;
        } else if (value >= 1000) {
            return `${symbol}${(value / 1000).toFixed(2)}K`;
        } else if (value < 1) {
            return `${symbol}${value.toFixed(4)}`;
        } else {
            return `${symbol}${value.toFixed(2)}`;
        }
    }
    
    // Default formatting for other currencies
    if (value < 1) {
        return `${symbol}${value.toFixed(6)}`;
    } else if (value < 100) {
        return `${symbol}${value.toFixed(2)}`;
    } else {
        return `${symbol}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    }
}

// Format Large Numbers
function formatLargeNumber(num) {
    if (!num) return 'N/A';
    
    // Special formatting for INR
    if (currentCurrency === 'inr') {
        if (num >= 1e15) {
            return (num / 1e15).toFixed(2) + 'P Cr'; // Peta Crores
        } else if (num >= 1e13) {
            return (num / 1e13).toFixed(2) + 'T Cr'; // Tera Crores  
        } else if (num >= 1e11) {
            return (num / 1e11).toFixed(2) + 'K Cr'; // Thousand Crores
        } else if (num >= 1e7) {
            return (num / 1e7).toFixed(2) + ' Cr'; // Crores
        } else if (num >= 1e5) {
            return (num / 1e5).toFixed(2) + 'L'; // Lakhs
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }
    
    // Default formatting for other currencies
    if (num >= 1e12) {
        return (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}
