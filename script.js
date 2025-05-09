// Variables globales
let map;
let userMarker;
let puntos = [];
let currentPosition = null;

// Definir un icono personalizado azul con imagen externa
const iconoAzul = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x-blue.png', // Icono azul oficial de Leaflet
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// Inicializar el mapa
function initMap() {
  map = L.map('map').setView([0, 0], 2);
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

  // Crear o mover el marcador del usuario con icono azul
  if (!userMarker) {
    userMarker = L.marker([lat, lng], { icon: iconoAzul }).addTo(map);
    map.setView([lat, lng], 16);
  } else {
    userMarker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }

  verificarDistancias(lat, lng);
}

// Manejar errores de geolocalización
function onLocationError(error) {
  console.error('Error de Geolocalización:', error);
}

// Calcular distancias y mostrar mensajes o preguntas
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

  const distanceMsg = document.getElementById('distanceMsg');
  const questionPanel = document.getElementById('questionPanel');

  if (puntoCercano) {
    if (distanciaMinima < 50) {
      mostrarPregunta(puntoCercano);
    } else if (distanciaMinima < 500) {
      const metros = Math.round(distanciaMinima);
      distanceMsg.textContent = `Estás a ${metros} metros de un punto de interés.`;
      distanceMsg.style.display = 'block';
      questionPanel.style.display = 'none';
      document.getElementById('feedback').style.display = 'none';
    } else {
      distanceMsg.style.display = 'none';
      questionPanel.style.display = 'none';
      document.getElementById('feedback').style.display = 'none';
    }
  } else {
    distanceMsg.style.display = 'none';
    questionPanel.style.display = 'none';
    document.getElementById('feedback').style.display = 'none';
  }
}

// Mostrar pregunta y respuestas para un punto
function mostrarPregunta(punto) {
  const distanceMsg = document.getElementById('distanceMsg');
  const questionPanel = document.getElementById('questionPanel');
  const questionText = document.getElementById('questionText');
  const answersContainer = document.getElementById('answersContainer');
  const feedback = document.getElementById('feedback');

  distanceMsg.style.display = 'none';
  feedback.style.display = 'none';
  feedback.textContent = '';

  questionPanel.style.display = 'block';
  questionText.textContent = punto.pregunta;
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
        feedback.textContent = '¡Respuesta correcta!';
        feedback.className = 'correct';
      } else {
        feedback.textContent = 'Respuesta incorrecta. La respuesta correcta es: ' + punto.respuestas.correcta;
        feedback.className = 'incorrect';
      }
      feedback.style.display = 'block';
      punto.respondida = true;
      setTimeout(() => {
        questionPanel.style.display = 'none';
        feedback.style.display = 'none';
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
  iniciarGeolocalizacion();
});

