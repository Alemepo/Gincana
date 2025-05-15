// Variables globales
let map;
let userMarker;
let puntos = [];
let currentPosition = null;
let currentNearest = null;
let answersObj = {};
let historyOpen = false;
let compassActive = false;
let archivoSeleccionado = null;

// Referencias a elementos de la interfaz (asignadas al cargar DOM)
let distanceMsgEl, questionPanelEl, feedbackEl, historyPanel, historyBtn, closeHistoryBtn, historyList, compassElement, arrowElement;

// Inicializar el mapa
function initMap() {
  map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

// Cargar puntos desde un archivo específico
async function cargarPuntos(archivo) {
  if (!archivo) return;
  puntos = [];
  historyList.innerHTML = '';
  try {
    const response = await fetch(archivo);
    if (!response.ok) throw new Error('Archivo no encontrado');
    puntos = await response.json();
    puntos.forEach(p => p.respondida = false);
    const savedData = localStorage.getItem('answers_' + archivo);
    if (savedData) {
      answersObj = JSON.parse(savedData);
      for (let idx in answersObj) {
        const i = parseInt(idx);
        if (puntos[i]) {
          puntos[i].respondida = true;
          puntos[i].acertada = answersObj[idx];
          const li = document.createElement('li');
          li.textContent = puntos[i].pregunta + " - ";
          const resultSpan = document.createElement('span');
          resultSpan.className = puntos[i].acertada ? 'correct' : 'incorrect';
          resultSpan.textContent = puntos[i].acertada ? 'Correcta \u2713' : 'Incorrecta \u2717';
          li.appendChild(resultSpan);
          historyList.appendChild(li);
        }
      }
    }
  } catch (error) {
    console.error('Error al cargar puntos:', error);
    alert('No se pudieron cargar las preguntas para la localidad seleccionada.');
  }
}

function iniciarGeolocalizacion() {
  if (!navigator.geolocation) {
    alert('Geolocalización no es soportada por este navegador.');
    return;
  }
  navigator.geolocation.watchPosition(onLocationFound, onLocationError, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 5000
  });
}

function onLocationFound(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  currentPosition = L.latLng(lat, lng);

  if (!userMarker) {
    userMarker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], 16);
  } else {
    userMarker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }

  verificarDistancias(lat, lng);
}

function onLocationError(error) {
  console.error('Error de Geolocalización:', error);
}

function verificarDistancias(lat, lng) {
  const usuario = L.latLng(lat, lng);
  let distanciaMinima = Infinity;
  let puntoCercano = null;
  puntos.forEach(p => {
    if (!p.respondida) {
      const puntoCoord = L.latLng(p.lat, p.lng);
      const dist = usuario.distanceTo(puntoCoord);
      if (dist < distanciaMinima) {
        distanciaMinima = dist;
        puntoCercano = p;
      }
    }
  });
  currentNearest = puntoCercano;
  if (historyOpen) return;
  if (puntoCercano) {
    if (distanciaMinima < 50) {
      mostrarPregunta(puntoCercano);
    } else {
      if (distanciaMinima >= 1000) {
        const km = parseFloat((distanciaMinima / 1000).toFixed(1));
        distanceMsgEl.textContent = `Estás a ${km} ${km === 1 ? 'kilómetro' : 'kilómetros'} del punto más cercano.`;
      } else {
        const metros = Math.round(distanciaMinima);
        distanceMsgEl.textContent = `Estás a ${metros} ${metros === 1 ? 'metro' : 'metros'} del punto más cercano.`;
      }
      distanceMsgEl.style.display = 'block';
      questionPanelEl.style.display = 'none';
      feedbackEl.style.display = 'none';
    }
  } else {
    distanceMsgEl.style.display = 'none';
    questionPanelEl.style.display = 'none';
    feedbackEl.style.display = 'none';
    if (compassElement) compassElement.style.display = 'none';
  }
}

function mostrarPregunta(punto) {
  distanceMsgEl.style.display = 'none';
  feedbackEl.style.display = 'none';
  feedbackEl.textContent = '';

  questionPanelEl.style.display = 'block';
  document.getElementById('questionText').textContent = punto.pregunta;
  const answersContainer = document.getElementById('answersContainer');
  answersContainer.innerHTML = '';

  let opciones = [];
  opciones.push({ texto: punto.respuestas.correcta, correcta: true });
  punto.respuestas.incorrectas.forEach(inc => {
    opciones.push({ texto: inc, correcta: false });
  });
  opciones.sort(() => Math.random() - 0.5);

  opciones.forEach(opcion => {
    const btn = document.createElement('button');
    btn.className = 'answerBtn';
    btn.textContent = opcion.texto;
    btn.onclick = function () {
      if (opcion.correcta) {
        feedbackEl.textContent = '¡Respuesta correcta!';
        feedbackEl.className = 'correct';
        punto.acertada = true;
      } else {
        feedbackEl.textContent = 'Respuesta incorrecta. La respuesta correcta es: ' + punto.respuestas.correcta;
        feedbackEl.className = 'incorrect';
        punto.acertada = false;
      }
      feedbackEl.style.display = 'block';
      punto.respondida = true;
      const index = puntos.indexOf(punto);
      answersObj[index] = punto.acertada;
      localStorage.setItem('answers_' + archivoSeleccionado, JSON.stringify(answersObj));
      const li = document.createElement('li');
      li.textContent = punto.pregunta + " - ";
      const resultSpan = document.createElement('span');
      resultSpan.className = punto.acertada ? 'correct' : 'incorrect';
      resultSpan.textContent = punto.acertada ? 'Correcta \u2713' : 'Incorrecta \u2717';
      li.appendChild(resultSpan);
      historyList.appendChild(li);
      setTimeout(() => {
        questionPanelEl.style.display = 'none';
        feedbackEl.style.display = 'none';
        verificarDistancias(currentPosition.lat, currentPosition.lng);
      }, 3000);
    };
    answersContainer.appendChild(btn);
  });
}

function handleOrientation(event) {
  if (!currentNearest || !currentPosition) return;
  let heading = event.alpha;
  if (event.webkitCompassHeading !== undefined) heading = event.webkitCompassHeading;
  if (heading === null) return;

  const userLat = currentPosition.lat * Math.PI / 180;
  const userLng = currentPosition.lng * Math.PI / 180;
  const targetLat = currentNearest.lat * Math.PI / 180;
  const targetLng = currentNearest.lng * Math.PI / 180;
  const dLon = targetLng - userLng;
  const y = Math.sin(dLon) * Math.cos(targetLat);
  const x = Math.cos(userLat) * Math.sin(targetLat) - Math.sin(userLat) * Math.cos(targetLat) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  const angle = (bearing - heading + 360) % 360;
  arrowElement.style.transform = `rotate(${angle}deg)`;
}

function startCompass() {
  if (compassActive) return;
  compassActive = true;
  arrowElement.style.color = 'red';
  window.addEventListener('deviceorientation', handleOrientation);
}

function openHistory() {
  historyPanel.style.display = 'block';
  historyOpen = true;
  historyBtn.style.display = 'none';
  distanceMsgEl.style.display = 'none';
}

function closeHistory() {
  historyPanel.style.display = 'none';
  historyOpen = false;
  historyBtn.style.display = 'block';
  if (currentPosition) verificarDistancias(currentPosition.lat, currentPosition.lng);
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  compassElement = document.getElementById('compass');
  arrowElement = document.getElementById('arrow');
  historyPanel = document.getElementById('historyPanel');
  historyBtn = document.getElementById('historyBtn');
  closeHistoryBtn = document.getElementById('closeHistory');
  historyList = document.getElementById('historyList');
  distanceMsgEl = document.getElementById('distanceMsg');
  questionPanelEl = document.getElementById('questionPanel');
  feedbackEl = document.getElementById('feedback');

  document.getElementById('locationSelect').addEventListener('change', event => {
    archivoSeleccionado = event.target.value;
    cargarPuntos(archivoSeleccionado);
  });

  iniciarGeolocalizacion();
});

