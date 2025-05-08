// Variables globales
let map;
let userMarker;
let puntos = [];
let currentPosition = null;

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
    userMarker = L.marker([lat, lng]).addTo(map);
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
  // Mezclar array de opciones
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
  iniciarGeolocalizacion();
});
