// ============================================================
// Konfigurasi koneksi MQTT (Maqiatto) - pakai library Paho MQTT
// ============================================================
const MQTT_CONFIG = {
  protocol: 'wss',          // wajib 'wss' karena dashboard dibuka lewat HTTPS (Netlify)
  host: 'broker.hivemq.com',
  port: 8884,                // TLS Websocket HiveMQ publik
};

// Harus SAMA PERSIS di script.js, logger.js, dan main.cpp.
// Broker ini publik: pakai nama unik dan panjang, jangan dibagikan ke orang lain.
const TOPIC_PREFIX = 'smarthome-usman-7k2q9';
const TOPIC_STATUS = `${TOPIC_PREFIX}/status`;   // ESP -> dashboard (subscribe)
const TOPIC_CONTROL = `${TOPIC_PREFIX}/control`; // dashboard -> ESP (publish)

// ============================================================
// Elemen UI (mengikuti id/class di dashboard.html)
// ============================================================
const securityCheckbox = document.getElementById('securityMode');
const motionStatusEl = document.getElementById('motion-status');
const logBody = document.getElementById('logBody');

const lightCheckboxes = {
  ruang_tamu: document.getElementById('light-ruang_tamu'),
  kamar: document.getElementById('light-kamar'),
  garasi: document.getElementById('light-garasi'),
};

// ============================================================
// Tombol didefinisikan lebih dulu, supaya UI tetap responsif
// walau koneksi MQTT gagal.
// ============================================================
window.mqttClientReady = false;
let mqttClient;

function publishControl(payload) {
  if (!window.mqttClientReady) {
    alert('Belum terhubung ke broker MQTT.');
    return;
  }
  try {
    const message = new Paho.MQTT.Message(JSON.stringify(payload));
    message.destinationName = TOPIC_CONTROL;
    mqttClient.send(message);
  } catch (err) {
    console.error('Gagal kirim pesan control:', err);
  }
}

function toggleLight(room, isOn) {
  publishControl({ light: room, state: isOn });
}
window.toggleLight = toggleLight; // wajib, karena script ini type="module"

securityCheckbox.addEventListener('change', () => {
  publishControl({ security_mode: securityCheckbox.checked });
});

// ============================================================
// Koneksi MQTT pakai Paho
// ============================================================
try {
  const clientId = 'dashboard_' + Math.random().toString(16).slice(2, 8);
  mqttClient = new Paho.MQTT.Client(MQTT_CONFIG.host, Number(MQTT_CONFIG.port), clientId);

  mqttClient.onConnectionLost = (responseObject) => {
    window.mqttClientReady = false;
    if (responseObject.errorCode !== 0) {
      console.error('MQTT connection lost:', responseObject.errorMessage);
    }
  };

  mqttClient.onMessageArrived = (message) => {
    if (message.destinationName !== TOPIC_STATUS) return;
    let data;
    try {
      data = JSON.parse(message.payloadString);
    } catch (e) {
      console.warn('Payload bukan JSON valid:', message.payloadString);
      return;
    }
    applyStatus(data);
  };

  mqttClient.connect({
    useSSL: MQTT_CONFIG.protocol === 'wss',
    onSuccess: () => {
      window.mqttClientReady = true;
      mqttClient.subscribe(TOPIC_STATUS, {
        onFailure: (err) => console.error('Subscribe gagal:', JSON.stringify(err)),
      });
    },
    onFailure: (err) => {
      console.error('Gagal connect MQTT:', err.errorMessage);
    },
  });
} catch (err) {
  console.error('Gagal membuat koneksi MQTT:', err);
}

// ============================================================
// Update tampilan berdasarkan data terbaru dari ESP
// ============================================================
let lastMotion = false;

function jamSekarang() {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' }) + ' WIB';
}

function applyStatus(data) {
  if (typeof data.security_mode === 'boolean') {
    securityCheckbox.checked = data.security_mode;
  }

  if (typeof data.motion === 'boolean') {
    motionStatusEl.textContent = data.motion ? 'TERDETEKSI' : 'AMAN';
    // Catat hanya saat berubah dari AMAN ke TERDETEKSI, supaya tabel tidak penuh baris ganda
    if (data.motion && !lastMotion) {
      addLogRow(jamSekarang(), 'Gerakan terdeteksi');
    }
    lastMotion = data.motion;
  }

  if (data.lights) {
    Object.keys(data.lights).forEach((room) => {
      const el = lightCheckboxes[room];
      if (el) el.checked = !!data.lights[room];
    });
  }
}

function addLogRow(waktu, status) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${waktu}</td><td>${status}</td>`;
  logBody.prepend(tr);
  while (logBody.children.length > 50) {
    logBody.removeChild(logBody.lastChild);
  }
}

// ============================================================
// Jam digital di halaman (waktu WIB, update tiap detik)
// ============================================================
const clockEl = document.getElementById('clock');

function updateClock() {
  if (!clockEl) return;
  const now = new Date();
  const tanggal = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const jam = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  clockEl.innerHTML = `<span class="clock-time">${jam}</span><span class="clock-date">${tanggal} · WIB</span>`;
}
updateClock();
setInterval(updateClock, 1000);

// ============================================================
// CATATAN: dashboard.html perlu baris ini SEBELUM tag
// <script type="module" src="script.js">:
//
// <script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"></script>
// ============================================================

// ============================================================
// Jam tampilan dashboard
// ============================================================

const dashboardTime = document.getElementById('dashboard-time');
const dashboardDate = document.getElementById('dashboard-date');

function updateDashboardClock() {
  const now = new Date();

  const time = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Jakarta'
  });

  const date = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (dashboardTime) {
    dashboardTime.textContent = time;
  }

  if (dashboardDate) {
    dashboardDate.textContent = date + ' · WIB';
  }
}

updateDashboardClock();
setInterval(updateDashboardClock, 1000);
