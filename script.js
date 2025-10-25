// ========== การตั้งค่าพื้นฐาน ==========
const ARDUINO_IP = 'http://192.168.1.100'; // เปลี่ยนเป็น IP ของ Arduino R4 WiFi
const FETCH_INTERVAL = 5000; // ดึงข้อมูลทุก 5 วินาที
const WEATHER_API_KEY = '7a89a85eb89b0c2793a803bf19d476f4'; // สำหรับ OpenWeatherMap (ไม่ใช้ก็ได้)

// ตัวแปรสถานะ
let currentLocation = null;
let useGPSMode = true; // โหมด GPS หรือ Manual
let weatherUpdateInterval;
let sensorUpdateInterval;
let gpsUpdateInterval;
let cameraStream = null;
let isCameraActive = false;

// ========== ฟังก์ชันอัปเดตวันที่และเวลา ==========
function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  const formatted = now.toLocaleString('en-US', options);
  const parts = formatted.split(', ');
  const datePart = parts.slice(0, -1).join(', ');
  const timePart = parts[parts.length - 1];
  
  const datetimeEl = document.getElementById('datetime');
  if (datetimeEl) {
    datetimeEl.textContent = `${datePart} | ${timePart}`;
  }
}

// ========== ฟังก์ชันจัดการ Wi-Fi Status ==========
function updateWifiStatus(isConnected) {
  const wifiStatus = document.getElementById('wifi-status');
  if (wifiStatus) {
    if (isConnected) {
      wifiStatus.innerHTML = '🟢 เชื่อมต่อแล้ว';
      wifiStatus.className = 'wifi-status';
    } else {
      wifiStatus.innerHTML = '🔴 ไม่ได้เชื่อมต่อ';
      wifiStatus.className = 'wifi-status disconnected';
    }
  }
}

// ========== แปลง Weather Code เป็นไอคอน ==========
function getWeatherIcon(code) {
  const weatherMap = {
    0: { icon: '☀️', text: 'ท้องฟ้าแจ่มใส' },
    1: { icon: '🌤️', text: 'แจ่มใสเป็นส่วนใหญ่' },
    2: { icon: '⛅', text: 'เมฆบางส่วน' },
    3: { icon: '☁️', text: 'มีเมฆมาก' },
    45: { icon: '🌫️', text: 'มีหมอก' },
    48: { icon: '🌫️', text: 'มีหมอกลงน้ำค้าง' },
    51: { icon: '🌦️', text: 'ฝนปรอยๆ' },
    53: { icon: '🌦️', text: 'ฝนปานกลาง' },
    55: { icon: '🌧️', text: 'ฝนหนัก' },
    61: { icon: '🌧️', text: 'ฝนเล็กน้อย' },
    63: { icon: '🌧️', text: 'ฝนปานกลาง' },
    65: { icon: '⛈️', text: 'ฝนหนัก' },
    71: { icon: '🌨️', text: 'หิมะเล็กน้อย' },
    73: { icon: '🌨️', text: 'หิมะปานกลาง' },
    75: { icon: '❄️', text: 'หิมะหนัก' },
    77: { icon: '🌨️', text: 'ลูกเห็บ' },
    80: { icon: '🌦️', text: 'ฝนตกเป็นห่วง' },
    81: { icon: '⛈️', text: 'ฝนตกหนัก' },
    82: { icon: '⛈️', text: 'ฝนตกหนักมาก' },
    85: { icon: '🌨️', text: 'หิมะตก' },
    86: { icon: '❄️', text: 'หิมะตกหนัก' },
    95: { icon: '⛈️', text: 'พายุฝนฟ้าคะนอง' },
    96: { icon: '⛈️', text: 'พายุฝนฟ้าคะนองพร้อมลูกเห็บ' },
    99: { icon: '⛈️', text: 'พายุฝนฟ้าคะนองรุนแรง' }
  };
  
  return weatherMap[code] || { icon: '🌡️', text: 'ไม่ทราบสภาพอากาศ' };
}

// ========== ดึงชื่อสถานที่จาก Latitude/Longitude ==========
async function getLocationName(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=th`
    );
    const data = await response.json();
    
    if (data.address) {
      const city = data.address.city || data.address.town || data.address.village || '';
      const country = data.address.country || '';
      return city && country ? `${city}, ${country}` : data.display_name.split(',').slice(0, 2).join(',');
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (error) {
    console.error('Error fetching location name:', error);
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

// ========== ดึงข้อมูลสภาพอากาศจาก Open-Meteo API ==========
async function fetchWeatherData() {
  const weatherLocation = document.getElementById('weather-location');
  if (!weatherLocation) return;
  
  // ถ้ายังไม่มีตำแหน่ง ใช้ค่าเริ่มต้น (Bangkok)
  if (!currentLocation) {
    currentLocation = {
      lat: 13.7563,
      lon: 100.5018
    };
  }
  
  weatherLocation.innerHTML = '⏳ กำลังโหลด...';
  
  try {
    const { lat, lon } = currentLocation;
    
    // ดึงข้อมูลสภาพอากาศจาก Open-Meteo (ฟรี ไม่ต้อง API Key)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้');
    }
    
    const data = await response.json();
    
    // อัปเดตชื่อสถานที่
    const locationName = await getLocationName(lat, lon);
    weatherLocation.innerHTML = `📍 ${locationName}`;
    
    // อัปเดตข้อมูลสภาพอากาศ
    const current = data.current;
    const daily = data.daily;
    
    const currentTempEl = document.getElementById('current-temp');
    if (currentTempEl) {
      currentTempEl.textContent = `${Math.round(current.temperature_2m)}°C`;
    }
    
    const weather = getWeatherIcon(current.weather_code);
    const weatherConditionEl = document.getElementById('weather-condition');
    if (weatherConditionEl) {
      weatherConditionEl.innerHTML = `${weather.icon} ${weather.text}`;
    }
    
    const tempHighEl = document.getElementById('temp-high');
    const tempLowEl = document.getElementById('temp-low');
    if (tempHighEl && tempLowEl) {
      tempHighEl.textContent = `${Math.round(daily.temperature_2m_max[0])}°C`;
      tempLowEl.textContent = `${Math.round(daily.temperature_2m_min[0])}°C`;
    }
    
    const weatherWindEl = document.getElementById('weather-wind');
    const weatherHumidityEl = document.getElementById('weather-humidity');
    if (weatherWindEl) {
      weatherWindEl.textContent = `${current.wind_speed_10m} m/s`;
    }
    if (weatherHumidityEl) {
      weatherHumidityEl.textContent = `${current.relative_humidity_2m}%`;
    }
    
    console.log('✅ ดึงข้อมูลสภาพอากาศสำเร็จ');
    
  } catch (error) {
    console.error('Weather fetch error:', error);
    weatherLocation.innerHTML = '❌ ไม่สามารถโหลดข้อมูลได้';
    const weatherConditionEl = document.getElementById('weather-condition');
    if (weatherConditionEl) {
      weatherConditionEl.innerHTML = '⚠️ เกิดข้อผิดพลาด';
    }
  }
}

// ========== ขอสิทธิ์เข้าถึงตำแหน่งปัจจุบัน (อัตโนมัติ) ==========
async function requestGeolocation() {
  if (!navigator.geolocation) {
    console.error('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };
      
      // บันทึกตำแหน่งล่าสุด
      saveLastLocation(currentLocation.lat, currentLocation.lon);
      
      useCurrentLocation = true;
      await fetchWeatherData();
      
      console.log('✅ อัปเดตตำแหน่ง GPS สำเร็จ');
    },
    (error) => {
      console.error('Geolocation error:', error);
      // ถ้าไม่ได้สิทธิ์ GPS ให้ใช้ตำแหน่งที่บันทึกไว้หรือค่าเริ่มต้น
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ========== ดึงข้อมูลเซ็นเซอร์จาก Arduino (Mock Data) ==========
async function fetchSensorData() {
  try {
    // ลองเชื่อมต่อกับ Arduino จริง
    const response = await fetch(`${ARDUINO_IP}/sensors`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('ไม่สามารถเชื่อมต่อกับบอร์ดได้');
    }
    
    const data = await response.json();
    updateSensorDisplay(data);
    updateWifiStatus(true);
    
  } catch (error) {
    // ถ้าเชื่อมไม่ได้ ใช้ข้อมูลจำลอง
    console.log('ใช้ข้อมูลจำลอง (Mock Data)');
    const mockData = generateMockSensorData();
    updateSensorDisplay(mockData);
    updateWifiStatus(false);
  }
}

// ========== สร้างข้อมูลเซ็นเซอร์จำลอง ==========
function generateMockSensorData() {
  return {
    ph: (Math.random() * 2 + 5.5).toFixed(2), // 5.5-7.5
    ec: (Math.random() * 1.5 + 1.0).toFixed(2), // 1.0-2.5
    humidity: Math.round(Math.random() * 30 + 50), // 50-80
    waterTemp: (Math.random() * 8 + 18).toFixed(1), // 18-26
    light: Math.round(Math.random() * 40000 + 10000) // 10000-50000
  };
}

// ========== อัปเดตการแสดงผลข้อมูลเซ็นเซอร์ ==========
function updateSensorDisplay(data) {
  // อัปเดตค่า pH
  if (data.ph !== undefined) {
    const phValueEl = document.getElementById('ph-value');
    const phStatusEl = document.getElementById('ph-status');
    if (phValueEl) {
      phValueEl.textContent = parseFloat(data.ph).toFixed(2);
    }
    if (phStatusEl) {
      phStatusEl.innerHTML = getPhStatus(parseFloat(data.ph));
    }
  }
  
  // อัปเดตค่า EC
  if (data.ec !== undefined) {
    const ecValueEl = document.getElementById('ec-value');
    const ecStatusEl = document.getElementById('ec-status');
    if (ecValueEl) {
      ecValueEl.innerHTML = `${parseFloat(data.ec).toFixed(2)}<span class="sensor-unit">mS/cm</span>`;
    }
    if (ecStatusEl) {
      ecStatusEl.innerHTML = getEcStatus(parseFloat(data.ec));
    }
  }
  
  // อัปเดตค่าความชื้น
  if (data.humidity !== undefined) {
    const humidityValueEl = document.getElementById('humidity-value');
    const humidityStatusEl = document.getElementById('humidity-status');
    if (humidityValueEl) {
      humidityValueEl.innerHTML = `${Math.round(data.humidity)}<span class="sensor-unit">%</span>`;
    }
    if (humidityStatusEl) {
      humidityStatusEl.innerHTML = getHumidityStatus(data.humidity);
    }
  }
  
  // อัปเดตอุณหภูมิน้ำ
  if (data.waterTemp !== undefined) {
    const waterTempValueEl = document.getElementById('water-temp-value');
    const waterTempStatusEl = document.getElementById('water-temp-status');
    if (waterTempValueEl) {
      waterTempValueEl.innerHTML = `${parseFloat(data.waterTemp).toFixed(1)}<span class="sensor-unit">°C</span>`;
    }
    if (waterTempStatusEl) {
      waterTempStatusEl.innerHTML = getWaterTempStatus(parseFloat(data.waterTemp));
    }
  }
  
  // อัปเดตค่าแสง
  if (data.light !== undefined) {
    const lightValueEl = document.getElementById('light-value');
    const lightStatusEl = document.getElementById('light-status');
    if (lightValueEl) {
      lightValueEl.innerHTML = `${Math.round(data.light)}<span class="sensor-unit">lux</span>`;
    }
    if (lightStatusEl) {
      lightStatusEl.innerHTML = getLightStatus(data.light);
    }
  }
  
  console.log('✅ อัปเดตข้อมูลเซ็นเซอร์สำเร็จ');
}

// ========== ฟังก์ชันตรวจสอบสถานะค่าเซ็นเซอร์ ==========
function getPhStatus(ph) {
  if (ph < 5.5) return '⚠️ ต่ำเกินไป';
  if (ph > 7.5) return '⚠️ สูงเกินไป';
  return '✅ ปกติ';
}

function getEcStatus(ec) {
  if (ec < 1.2) return '⚠️ ต่ำเกินไป';
  if (ec > 2.5) return '⚠️ สูงเกินไป';
  return '✅ ปกติ';
}

function getHumidityStatus(humidity) {
  if (humidity < 50) return '⚠️ แห้งเกินไป';
  if (humidity > 80) return '⚠️ ชื้นเกินไป';
  return '✅ ปกติ';
}

function getWaterTempStatus(temp) {
  if (temp < 18) return '⚠️ เย็นเกินไป';
  if (temp > 26) return '⚠️ ร้อนเกินไป';
  return '✅ ปกติ';
}

function getLightStatus(light) {
  if (light < 10000) return '⚠️ แสงน้อยเกินไป';
  if (light > 50000) return '⚠️ แสงมากเกินไป';
  return '✅ ปกติ';
}

// ========== อัปเดตข้อมูล Garden Info จาก Dropdown ==========
function handleLocationChange(event) {
  const value = event.target.value;
  
  const gardenNameEl = document.getElementById('garden-name-display');
  const gardenPlotEl = document.getElementById('garden-plot-id');
  const gardenAreaEl = document.getElementById('garden-area');
  
  if (!gardenNameEl || !gardenPlotEl || !gardenAreaEl) return;
  
  switch(value) {
    case 'bangkok':
      gardenNameEl.textContent = 'Spinach Garden 08';
      gardenPlotEl.textContent = 'PL-024';
      gardenAreaEl.textContent = '200 m²';
      break;
    case 'weilburg':
      gardenNameEl.textContent = 'Weilburg Farm';
      gardenPlotEl.textContent = 'WB-001';
      gardenAreaEl.textContent = '350 m²';
      break;
    case 'farm_a':
      gardenNameEl.textContent = 'Farm A Chiangmai';
      gardenPlotEl.textContent = 'CM-A12';
      gardenAreaEl.textContent = '500 m²';
      break;
  }
}

// ========== ฟังก์ชันจัดการกล้อง ==========
async function initCamera() {
  const cameraPreview = document.querySelector('.camera-preview');
  if (!cameraPreview) return;

  try {
    // ขอสิทธิ์เข้าถึงกล้อง
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment', // ใช้กล้องหลัง
        width: { ideal: 640 },
        height: { ideal: 480 }
      } 
    });
    
    // สร้าง video element
    let videoEl = cameraPreview.querySelector('video');
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';
      videoEl.style.objectFit = 'cover';
      cameraPreview.innerHTML = '';
      cameraPreview.appendChild(videoEl);
    }
    
    videoEl.srcObject = cameraStream;
    isCameraActive = true;
    
    console.log('✅ เปิดกล้องสำเร็จ');
    
  } catch (error) {
    console.error('Camera error:', error);
    cameraPreview.innerHTML = '📷<br><small>ไม่สามารถเปิดกล้องได้</small>';
    alert('ไม่สามารถเข้าถึงกล้องได้\nกรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    isCameraActive = false;
    
    const cameraPreview = document.querySelector('.camera-preview');
    if (cameraPreview) {
      cameraPreview.innerHTML = '🎥';
    }
    
    console.log('⏸️ ปิดกล้อง');
  }
}

function capturePhoto() {
  const cameraPreview = document.querySelector('.camera-preview');
  const videoEl = cameraPreview?.querySelector('video');
  
  if (!videoEl || !isCameraActive) {
    alert('กรุณาเปิดกล้องก่อน');
    return;
  }
  
  // สร้าง canvas เพื่อจับภาพ
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0);
  
  // แปลงเป็น image และดาวน์โหลด
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garden_photo_${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    
    // แสดง flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      z-index: 9999;
      animation: flash 0.3s;
    `;
    document.body.appendChild(flash);
    
    setTimeout(() => flash.remove(), 300);
    
    console.log('📸 จับภาพสำเร็จ');
  }, 'image/jpeg', 0.95);
}

// เพิ่ม CSS animation สำหรับ flash
const style = document.createElement('style');
style.textContent = `
  @keyframes flash {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
document.head.appendChild(style);

// ========== ตั้งค่า Camera Controls ==========
function setupCameraControls() {
  const cameraButtons = document.querySelectorAll('.camera-btn');
  if (cameraButtons.length === 0) return;
  
  cameraButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      switch(index) {
        case 0: // ปุ่มซ้าย - Toggle กล้อง
          if (isCameraActive) {
            stopCamera();
          } else {
            initCamera();
          }
          break;
        case 1: // ปุ่มกลาง - ถ่ายรูป
          capturePhoto();
          break;
        case 2: // ปุ่มขวาบน - Refresh
          if (isCameraActive) {
            stopCamera();
            setTimeout(() => initCamera(), 500);
          }
          break;
        case 3: // ปุ่มขวา - เปิดกล้อง
          if (!isCameraActive) {
            initCamera();
          }
          break;
      }
    });
  });
}

// ========== โหลดและบันทึกตำแหน่งล่าสุด ==========
function loadLastLocation() {
  try {
    const saved = localStorage.getItem('lastLocation');
    if (saved) {
      const location = JSON.parse(saved);
      console.log('📍 โหลดตำแหน่งล่าสุด:', location);
      return location;
    }
  } catch (error) {
    console.error('Error loading last location:', error);
  }
  
  // ถ้าไม่มีข้อมูลเก่า ใช้ค่าเริ่มต้น (Bangkok)
  return {
    lat: 13.7563,
    lon: 100.5018
  };
}

function saveLastLocation(lat, lon) {
  try {
    const location = { lat, lon };
    localStorage.setItem('lastLocation', JSON.stringify(location));
    console.log('💾 บันทึกตำแหน่งล่าสุด:', location);
  } catch (error) {
    console.error('Error saving last location:', error);
  }
}

// ========== เริ่มต้นระบบ ==========
function init() {
  console.log('🚀 กำลังเริ่มต้นระบบ I-HYDRO SMART...');
  
  // อัปเดตวันที่และเวลาทันที
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // โหลดตำแหน่งล่าสุด หรือใช้ค่าเริ่มต้น
  currentLocation = loadLastLocation();
  
  // ดึงข้อมูลสภาพอากาศครั้งแรก (จากตำแหน่งที่บันทึกไว้)
  fetchWeatherData();
  
  // ขอตำแหน่ง GPS ปัจจุบัน (จะอัปเดตทับตำแหน่งเก่า)
  requestGeolocation();
  
  // ดึงข้อมูลเซ็นเซอร์ครั้งแรก
  fetchSensorData();
  
  // ตั้งเวลาอัปเดตข้อมูลอัตโนมัติ
  weatherUpdateInterval = setInterval(fetchWeatherData, 60000); // ทุก 1 นาที
  sensorUpdateInterval = setInterval(fetchSensorData, FETCH_INTERVAL); // ทุก 5 วินาที
  
  // อัปเดตตำแหน่ง GPS ทุก 5 นาที
  setInterval(requestGeolocation, 300000); // ทุก 5 นาที
  
  // Event Listeners
  const gardenLocationSelect = document.getElementById('garden-location');
  
  if (gardenLocationSelect) {
    gardenLocationSelect.addEventListener('change', handleLocationChange);
  }
  
  // ตั้งค่า Camera Controls
  setupCameraControls();
  
  console.log('✅ ระบบเริ่มต้นสำเร็จ');
}

// ========== เริ่มต้นเมื่อโหลดหน้าเว็บเสร็จ ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ========== ทำความสะอาดเมื่อปิดหน้าเว็บ ==========
window.addEventListener('beforeunload', () => {
  if (weatherUpdateInterval) clearInterval(weatherUpdateInterval);
  if (sensorUpdateInterval) clearInterval(sensorUpdateInterval);
  if (cameraStream) stopCamera();
});

// ========== Export functions for global access ==========
window.iHydro = {
  updateDateTime,
  updateWifiStatus,
  fetchWeatherData,
  fetchSensorData,
  requestGeolocation,
  initCamera,
  stopCamera,
  capturePhoto,
  handleLocationChange
};