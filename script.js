// Variables globales
let map;
let userMarker;
let puntos = [];
let currentPosition = null;
let currentNearest = null;
let answersObj = {};
let historyOpen = false;
let compassActive = false;
// Referencias a elementos de la interfaz (asignadas al cargar DOM)
let distanceMsgEl, questionPanelEl, feedbackEl, historyPanel, historyBtn, closeHistoryBtn, historyList, compassElement, arrowElement;

// Inicializar el mapa
function initMap() {
  // Crear mapa centrado temporalmente
  map = L.map('map').setView([0, 0], 2);
  // Añadir capa de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

// Cargar puntos (preguntas) desde preguntas.json
async function cargarPuntos() {
  try {
    const response = await fetch('preguntas.json');
    puntos = await response.json();
    // Marcar todas las preguntas como no respondidas inicialmente
    puntos.forEach(p => p.respondida = false);
    // Restaurar respuestas previas de localStorage (si existen)
    const savedData = localStorage.getItem('answers');
    if (savedData) {
      answersObj = JSON.parse(savedData);
      for (let idx in answersObj) {
        const i = parseInt(idx);
        if (puntos[i]) {
          puntos[i].respondida = true;
          puntos[i].acertada = answersObj[idx];
          // Agregar a la lista del historial inicial
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
  }
}
// Iniciar geolocalización continua del usuario
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
// Al obtener la ubicación del usuario
function onLocationFound(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  currentPosition = L.latLng(lat, lng);
  // Crear o mover el marcador del usuario
  if (!userMarker) { 
    userMarker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], 16);
  } else {
    userMarker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }
// Verificar distancias a los puntos de interés
  verificarDistancias(lat, lng);
}
function onLocationError(error) {
  console.error('Error de Geolocalización:', error);
} 
// Verificar distancias y actualizar interfaz (mensaje de distancia o pregunta)
function verificarDistancias(lat, lng) {
  const usuario = L.latLng(lat, lng);
  let distanciaMinima = Infinity;
  let puntoCercano = null;
  // Buscar el punto más cercano no respondido
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
  // Actualizar punto de interés actual para la brújula
  currentNearest = puntoCercano;
  // Si el historial está abierto, no actualizar la interfaz (evitar superposición)
  if (historyOpen) {
    return;
  }
  if (puntoCercano) {
    if (distanciaMinima < 50) {
      // A menos de 50m: mostrar pregunta
      mostrarPregunta(puntoCercano);
      } else {
      // Mostrar distancia al punto más cercano (m o km según distancia)
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
    // No quedan puntos por responder
  distanceMsgEl.style.display = 'none';
    questionPanelEl.style.display = 'none';
    feedbackEl.style.display = 'none';
    // Ocultar brújula si ya no hay objetivos
    if (compassElement) {
      compassElement.style.display = 'none';
    }
  }
}
// Mostrar pregunta y opciones de respuesta para un punto
function mostrarPregunta(punto) {
  // Ocultar mensaje de distancia y limpiar feedback previo
  distanceMsgEl.style.display = 'none';
  feedbackEl.style.display = 'none';
  feedbackEl.textContent = '';
  // Mostrar panel de pregunta con la pregunta actual
  questionPanelEl.style.display = 'block';
  document.getElementById('questionText').textContent = punto.pregunta;
  const answersContainer = document.getElementById('answersContainer');
  answersContainer.innerHTML = '';
  // Preparar opciones (correcta + incorrectas) y mezclarlas aleatoriamente
  let opciones = [];
  opciones.push({ texto: punto.respuestas.correcta, correcta: true });
  punto.respuestas.incorrectas.forEach(inc => {
    opciones.push({ texto: inc, correcta: false });
  });
  opciones.sort(() => Math.random() - 0.5);
  // Crear botones para cada respuesta
  opciones.forEach(opcion => {
    const btn = document.createElement('button');
    btn.className = 'answerBtn';
    btn.textContent = opcion.texto;
    btn.onclick = function () {
      // Al hacer clic en una respuesta
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
      // Marcar el punto como respondido
      punto.respondida = true;
      // Guardar resultado en el historial (localStorage)
      const index = puntos.indexOf(punto);
      answersObj[index] = punto.acertada;
      localStorage.setItem('answers', JSON.stringify(answersObj));
      // Añadir entrada al panel de historial
      const li = document.createElement('li');
      li.textContent = punto.pregunta + " - ";
      const resultSpan = document.createElement('span');
      resultSpan.className = punto.acertada ? 'correct' : 'incorrect';
      resultSpan.textContent = punto.acertada ? 'Correcta \u2713' : 'Incorrecta \u2717';
      li.appendChild(resultSpan);
      historyList.appendChild(li);
      // Después de 3 segundos, ocultar pregunta y verificar distancias nuevamente
      setTimeout(() => {
        questionPanelEl.style.display = 'none';
        feedbackEl.style.display = 'none';
        verificarDistancias(currentPosition.lat, currentPosition.lng);
      }, 3000);
    };
    answersContainer.appendChild(btn);
  });
}
// Actualizar la flecha de la brújula según la orientación del dispositivo
function handleOrientation(event) {
  if (!currentNearest || !currentPosition) {
    return;
  }
  // Obtener el encabezado (heading) del dispositivo
  let heading = event.alpha;
  if (event.webkitCompassHeading !== undefined) {
    heading = event.webkitCompassHeading;
  }
  if (heading === null) {
    return;
  }
  // Calcular el ángulo de rumbo (bearing) hacia el punto de interés
  const userLat = currentPosition.lat * Math.PI / 180;
  const userLng = currentPosition.lng * Math.PI / 180;
  const targetLat = currentNearest.lat * Math.PI / 180;
  const targetLng = currentNearest.lng * Math.PI / 180;
  const dLon = targetLng - userLng;
  const y = Math.sin(dLon) * Math.cos(targetLat);
  const x = Math.cos(userLat) * Math.sin(targetLat) - Math.sin(userLat) * Math.cos(targetLat) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  // Calcular ángulo relativo entre el heading del dispositivo y el bearing
  const angle = (bearing - heading + 360) % 360;
  // Rotar la flecha de la brújula
  arrowElement.style.transform = `rotate(${angle}deg)`;
}

// Iniciar la brújula (solicitar orientación del dispositivo)
function startCompass() {
  if (compassActive) return;
  compassActive = true;
  arrowElement.style.color = 'red';
  window.addEventListener('deviceorientation', handleOrientation);
}

// Abrir el panel de historial
function openHistory() {
  historyPanel.style.display = 'block';
  historyOpen = true;
  historyBtn.style.display = 'none';
  distanceMsgEl.style.display = 'none';
}

// Cerrar el panel de historial
function closeHistory() {
  historyPanel.style.display = 'none';
  historyOpen = false;
  historyBtn.style.display = 'block';
  if (currentPosition) {
    verificarDistancias(currentPosition.lat, currentPosition.lng);
  }
}

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  // Asignar referencias a elementos de la interfaz
  compassElement = document.getElementById('compass');
  arrowElement = document.getElementById('arrow');
  historyPanel = document.getElementById('historyPanel');
  historyBtn = document.getElementById('historyBtn');
  closeHistoryBtn = document.getElementById('closeHistory');
  historyList = document.getElementById('historyList');
  distanceMsgEl = document.getElementById('distanceMsg');
  questionPanelEl = document.getElementById('questionPanel');
  feedbackEl = document.getElementById('feedback');
  // Configurar eventos de brújula e historial
  compassElement.onclick = function () {
    // Solicitar permiso en Safari / iOS
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(response => {
        if (response === 'granted') {
          startCompass();
        } else {
          alert('No se pudo activar la brújula sin permiso.');
        }
        }).catch(error => {
        console.error('Error al solicitar permiso de brújula:', error);
      });
    } else {
      // Otros navegadores
      startCompass();
    }
  };
  historyBtn.onclick = openHistory;
  closeHistoryBtn.onclick = closeHistory;
  // Cargar puntos y comenzar geolocalización
  cargarPuntos();
  iniciarGeolocalizacion();
});
