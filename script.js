// ========== การตั้งค่าพื้นฐาน ==========
const ARDUINO_IP = 'http://192.168.1.100'; // เปลี่ยนเป็น IP ของ Arduino R4 WiFi
const FETCH_INTERVAL = 5000; // ดึงข้อมูลทุก 5 วินาที
const WEATHER_API_KEY = '7a89a85eb89b0c2793a803bf19d476f4'; // ถ้าใช้ OpenWeatherMap (ไม่บังคับสำหรับ Open-Meteo)

// ตำแหน่งเริ่มต้น (ว่างไว้ก่อน รอ GPS)
let currentLocation = null;

let useCurrentLocation = false; // ยังไม่ได้เลือกตำแหน่ง
let weatherUpdateInterval;
let sensorUpdateInterval;

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
  
  document.getElementById('datetime').textContent = `${datePart} | ${timePart}`;
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
    
    document.getElementById('current-temp').textContent = `${Math.round(current.temperature_2m)}°C`;
    
    const weather = getWeatherIcon(current.weather_code);
    document.getElementById('weather-condition').innerHTML = `${weather.icon} ${weather.text}`;
    
    document.getElementById('temp-high').textContent = `${Math.round(daily.temperature_2m_max[0])}°C`;
    document.getElementById('temp-low').textContent = `${Math.round(daily.temperature_2m_min[0])}°C`;
    
    document.getElementById('weather-wind').textContent = `${current.wind_speed_10m} m/s`;
    document.getElementById('weather-humidity').textContent = `${current.relative_humidity_2m}%`;
    
    console.log('✅ ดึงข้อมูลสภาพอากาศสำเร็จ');
    
  } catch (error) {
    console.error('Weather fetch error:', error);
    weatherLocation.innerHTML = '❌ ไม่สามารถโหลดข้อมูลได้';
    document.getElementById('weather-condition').innerHTML = '⚠️ เกิดข้อผิดพลาด';
  }
}

// ========== ขอสิทธิ์เข้าถึงตำแหน่งปัจจุบัน ==========
async function requestGeolocation() {
  const btn = document.getElementById('use-current-location-btn');
  btn.textContent = '⏳ กำลังขอสิทธิ์...';
  btn.disabled = true;

  if (!navigator.geolocation) {
    alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง');
    btn.textContent = '❌ ไม่รองรับ';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };
      
      // อัปเดต input fields
      document.getElementById('manual-lat').value = currentLocation.lat.toFixed(4);
      document.getElementById('manual-lon').value = currentLocation.lon.toFixed(4);
      
      btn.textContent = '✅ ใช้ตำแหน่งปัจจุบัน';
      btn.style.background = 'rgba(76, 175, 80, 0.3)';
      btn.disabled = false;
      
      useCurrentLocation = true;
      await fetchWeatherData();
    },
    (error) => {
      console.error('Geolocation error:', error);
      let errorMsg = 'ไม่สามารถเข้าถึงตำแหน่งได้';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = 'คุณปิดการอนุญาตตำแหน่ง';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = 'ไม่สามารถหาตำแหน่งได้';
          break;
        case error.TIMEOUT:
          errorMsg = 'หมดเวลาในการค้นหา';
          break;
      }
      
      alert(errorMsg);
      btn.textContent = '📍 ลองอีกครั้ง';
      btn.disabled = false;
    }
  );
}

// ========== ปักหมุดตำแหน่งที่กำหนดเอง ==========
async function pinCustomLocation() {
  const latInput = document.getElementById('manual-lat');
  const lonInput = document.getElementById('manual-lon');
  
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  
  if (isNaN(lat) || isNaN(lon)) {
    alert('กรุณากรอก Latitude และ Longitude ที่ถูกต้อง');
    return;
  }
  
  if (lat < -90 || lat > 90) {
    alert('Latitude ต้องอยู่ระหว่าง -90 ถึง 90');
    return;
  }
  
  if (lon < -180 || lon > 180) {
    alert('Longitude ต้องอยู่ระหว่าง -180 ถึง 180');
    return;
  }
  
  currentLocation = { lat, lon };
  useCurrentLocation = false;
  
  const btn = document.getElementById('use-current-location-btn');
  btn.textContent = '📍 ตำแหน่งปัจจุบัน';
  btn.style.background = 'rgba(255, 255, 255, 0.2)';
  
  await fetchWeatherData();
}

// ========== ดึงข้อมูลเซ็นเซอร์จาก Arduino ==========
async function fetchSensorData() {
  try {
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
    
    // อัปเดตค่า pH
    if (data.ph !== undefined) {
      document.getElementById('ph-value').textContent = data.ph.toFixed(2);
      const phStatus = getPhStatus(data.ph);
      document.getElementById('ph-status').innerHTML = phStatus;
    }
    
    // อัปเดตค่า EC
    if (data.ec !== undefined) {
      document.getElementById('ec-value').innerHTML = `${data.ec.toFixed(2)}<span class="sensor-unit">mS/cm</span>`;
      const ecStatus = getEcStatus(data.ec);
      document.getElementById('ec-status').innerHTML = ecStatus;
    }
    
    // อัปเดตค่าความชื้น
    if (data.humidity !== undefined) {
      document.getElementById('humidity-value').innerHTML = `${Math.round(data.humidity)}<span class="sensor-unit">%</span>`;
      const humidityStatus = getHumidityStatus(data.humidity);
      document.getElementById('humidity-status').innerHTML = humidityStatus;
    }
    
    // อัปเดตอุณหภูมิน้ำ
    if (data.waterTemp !== undefined) {
      document.getElementById('water-temp-value').innerHTML = `${data.waterTemp.toFixed(1)}<span class="sensor-unit">°C</span>`;
      const waterTempStatus = getWaterTempStatus(data.waterTemp);
      document.getElementById('water-temp-status').innerHTML = waterTempStatus;
    }
    
    // อัปเดตค่าแสง
    if (data.light !== undefined) {
      document.getElementById('light-value').innerHTML = `${Math.round(data.light)}<span class="sensor-unit">lux</span>`;
      const lightStatus = getLightStatus(data.light);
      document.getElementById('light-status').innerHTML = lightStatus;
    }
    
    updateWifiStatus(true);
    console.log('✅ ดึงข้อมูลเซ็นเซอร์สำเร็จ:', data);
    
  } catch (error) {
    console.error('Sensor fetch error:', error);
    updateWifiStatus(false);
    
    // แสดงข้อความ "รอข้อมูล" เมื่อไม่สามารถเชื่อมต่อได้
    document.getElementById('ph-status').innerHTML = '⏳ รอข้อมูล';
    document.getElementById('ec-status').innerHTML = '⏳ รอข้อมูล';
    document.getElementById('humidity-status').innerHTML = '⏳ รอข้อมูล';
    document.getElementById('water-temp-status').innerHTML = '⏳ รอข้อมูล';
    document.getElementById('light-status').innerHTML = '⏳ รอข้อมูล';
  }
}

// ========== ฟังก์ชันตรวจสอบสถานะค่าเซ็นเซอร์ ==========
function getPhStatus(ph) {
  if (ph < 5.5) return '⚠️ ต่ำเกินไป';
  if (ph > 6.5) return '⚠️ สูงเกินไป';
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
  
  // อัปเดตข้อมูลสวน แต่ไม่เปลี่ยนตำแหน่งสภาพอากาศ
  switch(value) {
    case 'bangkok':
      document.getElementById('garden-name-display').textContent = 'Spinach Garden 08';
      document.getElementById('garden-plot-id').textContent = 'PL-024';
      document.getElementById('garden-area').textContent = '200 m²';
      break;
    case 'weilburg':
      document.getElementById('garden-name-display').textContent = 'Weilburg Farm';
      document.getElementById('garden-plot-id').textContent = 'WB-001';
      document.getElementById('garden-area').textContent = '350 m²';
      break;
    case 'farm_a':
      document.getElementById('garden-name-display').textContent = 'Farm A Chiangmai';
      document.getElementById('garden-plot-id').textContent = 'CM-A12';
      document.getElementById('garden-area').textContent = '500 m²';
      break;
  }
  
  // ไม่เปลี่ยนตำแหน่งสภาพอากาศ - ให้ใช้ตำแหน่งที่เลือกในการ์ดสภาพอากาศเท่านั้น
}

// ========== เริ่มต้นระบบ ==========
function init() {
  console.log('🚀 กำลังเริ่มต้นระบบ I-HYDRO SMART...');
  
  // อัปเดตวันที่และเวลาทันที
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // ดึงข้อมูลสภาพอากาศครั้งแรก
  fetchWeatherData();
  
  // ดึงข้อมูลเซ็นเซอร์ครั้งแรก
  fetchSensorData();
  
  // ตั้งเวลาอัปเดตข้อมูลอัตโนมัติ
  weatherUpdateInterval = setInterval(fetchWeatherData, 60000); // ทุก 1 นาที
  sensorUpdateInterval = setInterval(fetchSensorData, FETCH_INTERVAL); // ทุก 5 วินาที
  
  // Event Listeners
  document.getElementById('use-current-location-btn').addEventListener('click', requestGeolocation);
  document.getElementById('pin-location-btn').addEventListener('click', pinCustomLocation);
  document.getElementById('garden-location').addEventListener('change', handleLocationChange);
  
  // ไม่ต้องอัปเดต currentLocation แบบ realtime จาก input
  // ให้รอจนกว่าจะกดปุ่ม "ปักหมุดที่นี่" เท่านั้น
  
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
});