const API_URL = 'http://localhost:3000/api';

// 🔄 Update Current Time
function updateTime() {
  const now = new Date();
  document.getElementById('current-time').textContent = now.toLocaleTimeString('th-TH');
}

// 💾 Load Settings from LocalStorage
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('ihydrosmart_settings') || '{}');
  
  // Load thresholds
  if (settings.thresholds) {
    document.getElementById('temp-min').value = settings.thresholds.temperature?.min || 20;
    document.getElementById('temp-max').value = settings.thresholds.temperature?.max || 30;
    document.getElementById('humidity-min').value = settings.thresholds.humidity?.min || 60;
    document.getElementById('humidity-max').value = settings.thresholds.humidity?.max || 80;
    document.getElementById('ph-min').value = settings.thresholds.ph?.min || 5.5;
    document.getElementById('ph-max').value = settings.thresholds.ph?.max || 7.5;
    document.getElementById('ec-min').value = settings.thresholds.ec?.min || 1.0;
    document.getElementById('ec-max').value = settings.thresholds.ec?.max || 2.5;
    document.getElementById('water-min').value = settings.thresholds.water_level?.min || 5;
    document.getElementById('light-min').value = settings.thresholds.light?.min || 200;
  }

  // Load plant profile
  if (settings.plantProfile) {
    document.getElementById('farm-name').value = settings.plantProfile.farmName || 'แปลงผักไฮโดรโปนิกส์';
    document.getElementById('plant-type').value = settings.plantProfile.plantType || 'lettuce';
    document.getElementById('plant-date').value = settings.plantProfile.plantDate || '';
  }

  // Load auto control
  if (settings.autoControl) {
    document.getElementById('auto-water').checked = settings.autoControl.autoWater || false;
    document.getElementById('auto-light').checked = settings.autoControl.autoLight || false;
    document.getElementById('auto-fan').checked = settings.autoControl.autoFan || false;
    document.getElementById('auto-buzzer').checked = settings.autoControl.autoBuzzer !== false;
  }

  // Load system settings
  if (settings.system) {
    document.getElementById('update-interval').value = settings.system.updateInterval || 5;
    document.getElementById('data-retention').value = settings.system.dataRetention || 30;
  }
}

// 💾 Save Threshold Settings
function saveSettings() {
  const settings = JSON.parse(localStorage.getItem('ihydrosmart_settings') || '{}');
  
  settings.thresholds = {
    temperature: {
      min: parseFloat(document.getElementById('temp-min').value),
      max: parseFloat(document.getElementById('temp-max').value)
    },
    humidity: {
      min: parseFloat(document.getElementById('humidity-min').value),
      max: parseFloat(document.getElementById('humidity-max').value)
    },
    ph: {
      min: parseFloat(document.getElementById('ph-min').value),
      max: parseFloat(document.getElementById('ph-max').value)
    },
    ec: {
      min: parseFloat(document.getElementById('ec-min').value),
      max: parseFloat(document.getElementById('ec-max').value)
    },
    water_level: {
      min: parseFloat(document.getElementById('water-min').value)
    },
    light: {
      min: parseFloat(document.getElementById('light-min').value)
    }
  };

  localStorage.setItem('ihydrosmart_settings', JSON.stringify(settings));
  showNotification('บันทึกเกณฑ์ค่าสำเร็จ!', 'success');
}

// 💾 Save Plant Profile
function savePlantProfile() {
  const settings = JSON.parse(localStorage.getItem('ihydrosmart_settings') || '{}');
  
  settings.plantProfile = {
    farmName: document.getElementById('farm-name').value,
    plantType: document.getElementById('plant-type').value,
    plantDate: document.getElementById('plant-date').value
  };

  localStorage.setItem('ihydrosmart_settings', JSON.stringify(settings));
  showNotification('บันทึกโปรไฟล์พืชสำเร็จ!', 'success');
}

// 💾 Save Auto Control Settings
function saveAutoControl() {
  const settings = JSON.parse(localStorage.getItem('ihydrosmart_settings') || '{}');
  
  settings.autoControl = {
    autoWater: document.getElementById('auto-water').checked,
    autoLight: document.getElementById('auto-light').checked,
    autoFan: document.getElementById('auto-fan').checked,
    autoBuzzer: document.getElementById('auto-buzzer').checked
  };

  localStorage.setItem('ihydrosmart_settings', JSON.stringify(settings));
  showNotification('บันทึกการควบคุมอัตโนมัติสำเร็จ!', 'success');
}

// 💾 Save System Settings
function saveSystemSettings() {
  const settings = JSON.parse(localStorage.getItem('ihydrosmart_settings') || '{}');
  
  settings.system = {
    updateInterval: parseInt(document.getElementById('update-interval').value),
    dataRetention: parseInt(document.getElementById('data-retention').value)
  };

  localStorage.setItem('ihydrosmart_settings', JSON.stringify(settings));
  showNotification('บันทึกการตั้งค่าระบบสำเร็จ!', 'success');
}

// 🗑️ Clear All Data
async function clearAllData() {
  if (!confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้!')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/data/clear`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(`ลบข้อมูลสำเร็จ! (${result.deleted} รายการ)`, 'success');
    }
  } catch (error) {
    console.error('Error clearing data:', error);
    showNotification('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
  }
}

// 🔄 Reset Settings
function resetSettings() {
  if (!confirm('คุณแน่ใจหรือไม่ที่จะรีเซ็ตการตั้งค่าทั้งหมด?')) {
    return;
  }

  localStorage.removeItem('ihydrosmart_settings');
  location.reload();
  showNotification('รีเซ็ตการตั้งค่าสำเร็จ!', 'success');
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

// 📡 Check Connection
async function checkConnection() {
  try {
    const response = await fetch(`${API_URL}/data/latest`);
    if (response.ok) {
      document.getElementById('wifi-status').textContent = '🟢 เชื่อมต่อแล้ว';
      document.getElementById('wifi-status').style.background = '#d4edda';
      document.getElementById('wifi-status').style.color = '#155724';
    }
  } catch (error) {
    document.getElementById('wifi-status').textContent = '🔴 ไม่ได้เชื่อมต่อ';
    document.getElementById('wifi-status').style.background = '#f8d7da';
    document.getElementById('wifi-status').style.color = '#721c24';
  }
}

// 🚀 Initialize
function init() {
  updateTime();
  loadSettings();
  checkConnection();
  setInterval(updateTime, 1000);
}

window.addEventListener('DOMContentLoaded', init);