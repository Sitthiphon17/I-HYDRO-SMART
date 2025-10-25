const API_URL = 'http://localhost:3000/api';
let currentFilter = 'today';
let allData = [];

// 🔄 Update Current Time
function updateTime() {
  const now = new Date();
  document.getElementById('current-time').textContent = now.toLocaleTimeString('th-TH');
}

// 📊 Fetch History Data
async function fetchHistoryData(filter = 'all') {
  try {
    const response = await fetch(`${API_URL}/data/history?limit=1000`);
    const data = await response.json();
    
    allData = data;
    const filteredData = filterDataByPeriod(data, filter);
    
    displayTable(filteredData);
    calculateStats(filteredData);

    document.getElementById('wifi-status').textContent = '🟢 เชื่อมต่อแล้ว';
    document.getElementById('wifi-status').style.background = '#d4edda';
    document.getElementById('wifi-status').style.color = '#155724';
  } catch (error) {
    console.error('Error fetching history:', error);
    document.getElementById('wifi-status').textContent = '🔴 ไม่ได้เชื่อมต่อ';
    document.getElementById('wifi-status').style.background = '#f8d7da';
    document.getElementById('wifi-status').style.color = '#721c24';
  }
}

// 🔍 Filter Data by Period
function filterDataByPeriod(data, period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch(period) {
    case 'today':
      return data.filter(d => new Date(d.timestamp) >= today);
    case 'week':
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return data.filter(d => new Date(d.timestamp) >= weekAgo);
    case 'month':
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return data.filter(d => new Date(d.timestamp) >= monthAgo);
    default:
      return data;
  }
}

// 📋 Display Data Table
function displayTable(data) {
  const tbody = document.getElementById('data-table-body');
  
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">ไม่มีข้อมูล</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${new Date(row.timestamp).toLocaleString('th-TH')}</td>
      <td>${row.temperature.toFixed(1)}</td>
      <td>${row.humidity.toFixed(1)}</td>
      <td>${row.light.toFixed(0)}</td>
      <td>${row.ec.toFixed(2)}</td>
      <td>${row.tds.toFixed(0)}</td>
      <td>${row.ph.toFixed(2)}</td>
      <td>${row.water_level.toFixed(1)}</td>
    </tr>
  `).join('');
}

// 📊 Calculate Statistics
function calculateStats(data) {
  if (data.length === 0) {
    document.getElementById('total-records').textContent = '0';
    document.getElementById('avg-temp').textContent = '--';
    document.getElementById('avg-humidity').textContent = '--';
    document.getElementById('avg-ph').textContent = '--';
    return;
  }
  
  const avgTemp = data.reduce((sum, d) => sum + d.temperature, 0) / data.length;
  const avgHumidity = data.reduce((sum, d) => sum + d.humidity, 0) / data.length;
  const avgPh = data.reduce((sum, d) => sum + d.ph, 0) / data.length;
  
  document.getElementById('total-records').textContent = data.length;
  document.getElementById('avg-temp').textContent = `${avgTemp.toFixed(1)} °C`;
  document.getElementById('avg-humidity').textContent = `${avgHumidity.toFixed(1)} %`;
  document.getElementById('avg-ph').textContent = avgPh.toFixed(2);
}

// 🔍 Filter Data
function filterData(period) {
  currentFilter = period;
  
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  const filteredData = filterDataByPeriod(allData, period);
  displayTable(filteredData);
  calculateStats(filteredData);
}

// 📥 Export to CSV
function exportToCSV() {
  const filteredData = filterDataByPeriod(allData, currentFilter);
  
  if (filteredData.length === 0) {
    alert('ไม่มีข้อมูลสำหรับ Export');
    return;
  }
  
  // Create CSV content
  let csv = 'เวลา,อุณหภูมิ(°C),ความชื้น(%),แสง(Lux),EC(mS/cm),TDS(ppm),pH,น้ำ(cm)\n';
  
  filteredData.forEach(row => {
    csv += `${new Date(row.timestamp).toLocaleString('th-TH')},`;
    csv += `${row.temperature},${row.humidity},${row.light},`;
    csv += `${row.ec},${row.tds},${row.ph},${row.water_level}\n`;
  });
  
  // Download CSV
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `ihydrosmart_${currentFilter}_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification('Export สำเร็จ!', 'success');
}

// 🔔 Show Notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// 🚀 Initialize
function init() {
  updateTime();
  fetchHistoryData('today');
  setInterval(updateTime, 1000);
  setInterval(() => fetchHistoryData(currentFilter), 30000);
}

window.addEventListener('DOMContentLoaded', init);