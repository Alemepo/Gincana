// Variables globales
let map;
let userMarker;
let puntos = [];
let currentPosition = null;
let history = [];
let nearestPoint = null;
let deviceHeading = null;
let compassArrowEl;
let historyListEl;

// Icono personalizado para marcador de usuario
const iconoAzul = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// Inicializar el mapa
function initMap() {
  // Crear mapa centrado temporalmente (visibilidad mundial)
  map = L.map('map').setView([0, 0], 2);
  // Capa de mapa (OpenStreetMap)
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
    // Agregar propiedad 'respondida' a cada punto
    puntos.forEach(p => p.respondida = false);
  } catch (error) {
    console.error('Error al cargar puntos:', error);
  }
}

// Obtener ubicación del usuario continuamente
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

// Función llamada cuando se obtiene la ubicación
function onLocationFound(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  currentPosition = L.latLng(lat, lng);

  // Actualizar marcador de usuario
  if (!userMarker) {
    // Primera vez: crear marcador en la ubicación del usuario
    userMarker = L.marker([lat, lng], { icon: iconoAzul }).addTo(map);
    map.setView([lat, lng], 16);
  } else {
    // Actualizar marcador existente y centrar mapa
    userMarker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }

  // Verificar distancias con puntos de interés
  verificarDistancias(lat, lng);
}

// Manejar errores de geolocalización
function onLocationError(error) {
  console.error('Error de Geolocalización:', error);
}

// Calcular rumbo hacia el punto más cercano
function calcularRumbo(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaLambda = (lng2 - lng1) * rad;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let theta = Math.atan2(y, x) * (180 / Math.PI);
  return (theta + 360) % 360;
}

function updateCompass(bearing) {
  if (!compassArrowEl) return;
  if (deviceHeading === null) {
    compassArrowEl.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
  } else {
    let angle = bearing - deviceHeading;
    angle = (angle + 360) % 360;
    compassArrowEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
  }
}

// Calcular distancias y mostrar mensajes o preguntas
function verificarDistancias(lat, lng) {
  const usuario = L.latLng(lat, lng);
  let distanciaMinima = Infinity;
  let puntoCercano = null;
  // Encontrar punto no respondido más cercano
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

  const distanceMsg = document.getElementById('distanceMsg');
  const questionPanel = document.getElementById('questionPanel');

  if (puntoCercano) {
    if (distanciaMinima < 50) {
      // A menos de 50 m: mostrar pregunta
      mostrarPregunta(puntoCercano);
    } else if (distanciaMinima < 500) {
      // Entre 50 m y 500 m: mostrar distancia
      const metros = Math.round(distanciaMinima);
      distanceMsg.textContent = `Estás a ${metros} metros de un punto de interés.`;
      distanceMsg.style.display = 'block';
      // Ocultar panel de pregunta si estaba visible
      questionPanel.style.display = 'none';
      // Ocultar feedback si estaba visible
      document.getElementById('feedback').style.display = 'none';
    } else {
      // A más de 500 m: ocultar mensajes
      distanceMsg.style.display = 'none';
      questionPanel.style.display = 'none';
      document.getElementById('feedback').style.display = 'none';
    }
  } else {
    // No quedan puntos por responder
    distanceMsg.style.display = 'none';
    questionPanel.style.display = 'none';
    document.getElementById('feedback').style.display = 'none';
  }
  // Actualizar brújula
  if (puntoCercano) {
    nearestPoint = puntoCercano;
    const bearing = calcularRumbo(lat, lng, puntoCercano.lat, puntoCercano.lng);
    if (compassArrowEl) {
      compassArrowEl.style.display = 'block';
      updateCompass(bearing);
    }
  } else {
    nearestPoint = null;
    if (compassArrowEl) {
      compassArrowEl.style.display = 'none';
    }
  }
}

// Mostrar pregunta y respuestas para un punto
function mostrarPregunta(punto) {
  const distanceMsg = document.getElementById('distanceMsg');
  const questionPanel = document.getElementById('questionPanel');
  const questionText = document.getElementById('questionText');
  const answersContainer = document.getElementById('answersContainer');
  const feedback = document.getElementById('feedback');

  // Ocultar mensaje de distancia y limpiar feedback anterior
  distanceMsg.style.display = 'none';
  feedback.style.display = 'none';
  feedback.textContent = '';

  // Mostrar panel de pregunta
  questionPanel.style.display = 'block';
  questionText.textContent = punto.pregunta;
  answersContainer.innerHTML = '';

  // Preparar respuestas (correcta e incorrectas) y mezclar
  let opciones = [];
  opciones.push({ texto: punto.respuestas.correcta, correcta: true });
  punto.respuestas.incorrectas.forEach(inc => {
    opciones.push({ texto: inc, correcta: false });
  });
  opciones.sort(() => Math.random() - 0.5);

  // Crear botones para respuestas
  opciones.forEach(opcion => {
    const btn = document.createElement('button');
    btn.className = 'answerBtn';
    btn.textContent = opcion.texto;
    btn.onclick = function() {
      // Al seleccionar una respuesta
      if (opcion.correcta) {
        feedback.textContent = '¡Respuesta correcta!';
        feedback.className = 'correct';
      } else {
        feedback.textContent = 'Respuesta incorrecta. La respuesta correcta es: ' + punto.respuestas.correcta;
        feedback.className = 'incorrect';
      }
      feedback.style.display = 'block';
      // Guardar en historial
      history.push({ question: punto.pregunta, correct: opcion.correcta });
      localStorage.setItem('history', JSON.stringify(history));
      if (historyListEl) {
        const li = document.createElement('li');
        li.innerHTML = punto.pregunta + ' - <span class="' + (opcion.correcta ? 'correct' : 'incorrect') + '">' + (opcion.correcta ? 'Correcta' : 'Incorrecta') + '</span>';
        historyListEl.appendChild(li);
      }
      // Marcar el punto como respondido
      punto.respondida = true;
      // Después de 3 segundos, ocultar pregunta y actualizar distancias
      setTimeout(() => {
        questionPanel.style.display = 'none';
        feedback.style.display = 'none';
        // Verificar nuevamente distancias para actualizar el mensaje
        verificarDistancias(currentPosition.lat, currentPosition.lng);
      }, 3000);
    };
    answersContainer.appendChild(btn);
  });
}

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  cargarPuntos();
  // Inicializar elementos de historial y brújula
  compassArrowEl = document.getElementById('compassArrow');
  historyListEl = document.getElementById('historyList');
  // Cargar historial de preguntas desde localStorage
  const savedHistory = localStorage.getItem('history');
  if (savedHistory) {
    history = JSON.parse(savedHistory);
    history.forEach(entry => {
      const li = document.createElement('li');
      li.innerHTML = entry.question + ' - <span class="' + (entry.correct ? 'correct' : 'incorrect') + '">' + (entry.correct ? 'Correcta' : 'Incorrecta') + '</span>';
      historyListEl.appendChild(li);
    });
  }
  // Escuchar orientación del dispositivo para actualizar brújula
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
      if (event.alpha !== null) {
        deviceHeading = event.alpha;
        if (nearestPoint && currentPosition) {
          const brg = calcularRumbo(currentPosition.lat, currentPosition.lng, nearestPoint.lat, nearestPoint.lng);
          updateCompass(brg);
        }
      }
    });
  }
  iniciarGeolocalizacion();
});

