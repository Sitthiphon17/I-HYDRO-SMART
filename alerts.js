const API_URL = 'http://localhost:3000/api';

// เกณฑ์การแจ้งเตือน
const THRESHOLDS = {
  temperature: { min: 20, max: 30 },
  humidity: { min: 60, max: 80 },
  ph: { min: 5.5, max: 7.5 },
  ec: { min: 1.0, max: 2.5 },
  water_level: { min: 5 },
  light: { min: 200 }
};

let alertHistory = [];

// 🔄 Update Current Time
function updateTime() {
  const now = new Date();
  document.getElementById('current-time').textContent = now.toLocaleTimeString('th-TH');
}

// 📡 Fetch Latest Data and Check Alerts
async function checkAlerts() {
  try {
    const response = await fetch(`${API_URL}/data/latest`);
    const data = await response.json();

    if (data.temperature !== undefined) {
      updateStatus('temp', data.temperature, THRESHOLDS.temperature, '°C');
      updateStatus('humidity', data.humidity, THRESHOLDS.humidity, '%');
      updateStatus('ph', data.ph, THRESHOLDS.ph, '');
      updateStatus('ec', data.ec, THRESHOLDS.ec, ' mS/cm');
      updateStatus('water', data.water_level, THRESHOLDS.water_level, ' cm');
      updateStatus('light', data.light, THRESHOLDS.light, ' Lux');

      updateSummary();

      document.getElementById('wifi-status').textContent = '🟢 เชื่อมต่อแล้ว';
      document.getElementById('wifi-status').style.background = '#d4edda';
      document.getElementById('wifi-status').style.color = '#155724';
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
    document.getElementById('wifi-status').textContent = '🔴 ไม่ได้เชื่อมต่อ';
    document.getElementById('wifi-status').style.background = '#f8d7da';
    document.getElementById('wifi-status').style.color = '#721c24';
  }
}

// 📊 Update Status Item
function updateStatus(id, value, threshold, unit) {
  const statusItem = document.getElementById(`status-${id}`);
  const currentElement = document.getElementById(`${id}-current`);
  const badge = statusItem.querySelector('.status-badge');

  currentElement.textContent = value.toFixed(1) + unit;

  let status = 'normal';
  let statusText = 'ปกติ';
  let alertLevel = 'normal';

  if (threshold.min !== undefined && threshold.max !== undefined) {
    if (value < threshold.min || value > threshold.max) {
      status = 'critical';
      statusText = 'วิกฤติ';
      alertLevel = 'critical';
      addAlert(id, value, threshold, unit, 'critical');
    } else if (value < threshold.min + 2 || value > threshold.max - 2) {
      status = 'warning';
      statusText = 'เตือน';
      alertLevel = 'warning';
      addAlert(id, value, threshold, unit, 'warning');
    }
  } else if (threshold.min !== undefined) {
    if (value < threshold.min) {
      status = 'critical';
      statusText = 'วิกฤติ';
      alertLevel = 'critical';
      addAlert(id, value, threshold, unit, 'critical');
    } else if (value < threshold.min + 10) {
      status = 'warning';
      statusText = 'เตือน';
      alertLevel = 'warning';
      addAlert(id, value, threshold, unit, 'warning');
    }
  }

  statusItem.className = `status-item ${status}`;
  badge.className = `status-badge ${status}`;
  badge.textContent = statusText;
}

// 🔔 Add Alert to History
function addAlert(id, value, threshold, unit, level) {
  const nameMap = {
    'temp': 'อุณหภูมิ',
    'humidity': 'ความชื้น',
    'ph': 'ค่า pH',
    'ec': 'EC',
    'water': 'ระดับน้ำ',
    'light': 'ความเข้มแสง'
  };

  const now = new Date();
  const timeStr = now.toLocaleString('th-TH');

  // ตรวจสอบว่ามีการแจ้งเตือนซ้ำภายใน 5 นาทีหรือไม่
  const recentAlert = alertHistory.find(a => 
    a.id === id && 
    a.level === level && 
    (now - new Date(a.timestamp)) < 5 * 60 * 1000
  );

  if (!recentAlert) {
    const alert = {
      id,
      name: nameMap[id],
      value,
      threshold,
      unit,
      level,
      timestamp: now.toISOString(),
      timeStr
    };

    alertHistory.unshift(alert);
    
    // เก็บเฉพาะ 50 รายการล่าสุด
    if (alertHistory.length > 50) {
      alertHistory = alertHistory.slice(0, 50);
    }

    displayAlertHistory();
  }
}

// 📋 Display Alert History
function displayAlertHistory() {
  const alertList = document.getElementById('alert-list');

  if (alertHistory.length === 0) {
    alertList.innerHTML = '<div class="alert-empty">ยังไม่มีการแจ้งเตือน</div>';
    return;
  }

  alertList.innerHTML = alertHistory.map(alert => {
    const icon = alert.level === 'critical' ? '🔴' : '🟠';
    const levelText = alert.level === 'critical' ? 'วิกฤติ' : 'เตือน';
    
    let message = '';
    if (alert.threshold.min !== undefined && alert.threshold.max !== undefined) {
      message = `${alert.name}: ${alert.value.toFixed(1)}${alert.unit} (ปกติ: ${alert.threshold.min}-${alert.threshold.max}${alert.unit})`;
    } else {
      message = `${alert.name}: ${alert.value.toFixed(1)}${alert.unit} (ต่ำกว่าเกณฑ์: ${alert.threshold.min}${alert.unit})`;
    }

    return `
      <div class="alert-item ${alert.level}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <div class="alert-level">${levelText}</div>
          <div class="alert-message">${message}</div>
          <div class="alert-time">🕒 ${alert.timeStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 📊 Update Summary Counts
function updateSummary() {
  const critical = document.querySelectorAll('.status-item.critical').length;
  const warning = document.querySelectorAll('.status-item.warning').length;
  const normal = document.querySelectorAll('.status-item.normal').length;

  document.getElementById('critical-count').textContent = critical;
  document.getElementById('warning-count').textContent = warning;
  document.getElementById('normal-count').textContent = normal;
}

// 🚀 Initialize
function init() {
  updateTime();
  checkAlerts();
  setInterval(updateTime, 1000);
  setInterval(checkAlerts, 5000); // ตรวจสอบทุก 5 วินาที
}

window.addEventListener('DOMContentLoaded', init);