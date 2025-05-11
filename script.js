// Variables globales
let map;
let userMarker;
let puntos = [];
let currentPosition = null;
let orientationReceived = false;

// Inicializar el mapa con Leaflet
function initMap() {
  // Crear el mapa centrado temporalmente
  map = L.map('map').setView([0, 0], 2);
  // Añadir capa de mapa (OpenStreetMap)
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
    // No añadimos marcadores de mapa para mantener los puntos ocultos

    // Marcar como respondidos los puntos almacenados en localStorage
    const respondidasLS = JSON.parse(localStorage.getItem('answered') || '[]');
    puntos.forEach(p => {
      if (respondidasLS.includes(p.titulo)) {
        p.respondida = true;
      }
    });
    // Llenar la lista de preguntas contestadas correctamente
    const listaHTML = document.getElementById('answeredList');
    listaHTML.innerHTML = '';
    respondidasLS.forEach(titulo => {
      const li = document.createElement('li');
      li.textContent = titulo;
      listaHTML.appendChild(li);
    });
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

  // Crear o mover el marcador del usuario en el mapa
  if (!userMarker) {
    // Primera vez: crear marcador del usuario
    userMarker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], 16);
  } else {
    // Actualizar ubicación del marcador existente
    userMarker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }

  // Verificar distancias con los puntos de interés
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

  // Encontrar el punto no respondido más cercano
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
    // Siempre mostrar la distancia al punto más cercano
    const distMeters = distanciaMinima;
    let distTexto;
    if (distMeters >= 1000) {
      const distKm = distMeters / 1000;
      if (distKm >= 10) {
        distTexto = Math.round(distKm) + ' km';
      } else {
        distTexto = (Math.round(distKm * 10) / 10).toString().replace('.', ',') + ' km';
      }
    } else {
      const metros = Math.round(distMeters);
      distTexto = metros + ' metros';
    }
    distanceMsg.textContent = `Estás a ${distTexto} del punto más cercano.`;
    distanceMsg.style.display = 'block';
    // Ocultar cualquier mensaje de feedback anterior
    document.getElementById('feedback').style.display = 'none';

    if (distanciaMinima < 50) {
      // A menos de 50 m: mostrar pregunta
      mostrarPregunta(puntoCercano);
    } else {
      // Más lejos: ocultar panel de pregunta
      questionPanel.style.display = 'none';
    }
  } else {
    // No quedan puntos por responder: mostrar mensaje de finalización
    distanceMsg.textContent = '¡Enhorabuena! Has respondido todas las preguntas.';
    distanceMsg.style.display = 'block';
    questionPanel.style.display = 'none';
    document.getElementById('feedback').style.display = 'none';
  }
}

// Mostrar pregunta y respuestas para un punto cercano
function mostrarPregunta(punto) {
  const distanceMsg = document.getElementById('distanceMsg');
  const questionPanel = document.getElementById('questionPanel');
  const questionText = document.getElementById('questionText');
  const answersContainer = document.getElementById('answersContainer');
  const feedback = document.getElementById('feedback');

  // Limpiar feedback anterior
  feedback.style.display = 'none';
  feedback.textContent = '';

  // Mostrar panel de pregunta
  questionPanel.style.display = 'block';
  questionText.textContent = punto.pregunta;
  answersContainer.innerHTML = '';

  // Preparar opciones de respuesta (mezclar aleatoriamente)
  let opciones = [];
  opciones.push({ texto: punto.respuestas.correcta, correcta: true });
  punto.respuestas.incorrectas.forEach(inc => {
    opciones.push({ texto: inc, correcta: false });
  });
  opciones.sort(() => Math.random() - 0.5);

  // Crear botones para las respuestas
  opciones.forEach(opcion => {
    const btn = document.createElement('button');
    btn.className = 'answerBtn';
    btn.textContent = opcion.texto;
    btn.onclick = function() {
      // Al seleccionar una respuesta
      if (opcion.correcta) {
        feedback.textContent = '¡Respuesta correcta!';
        feedback.className = 'correct';
        // Guardar punto respondido correctamente en localStorage
        let answered = JSON.parse(localStorage.getItem('answered') || '[]');
        if (!answered.includes(punto.titulo)) {
          answered.push(punto.titulo);
          localStorage.setItem('answered', JSON.stringify(answered));
        }
        // Añadir esta pregunta a la lista de contestadas
        const li = document.createElement('li');
        li.textContent = punto.titulo;
        document.getElementById('answeredList').appendChild(li);
      } else {
        feedback.textContent = 'Respuesta incorrecta. La respuesta correcta es: ' + punto.respuestas.correcta;
        feedback.className = 'incorrect';
      }
      feedback.style.display = 'block';
      // Marcar el punto como respondido (no se volverá a preguntar)
      punto.respondida = true;
      // Tras 3 segundos, ocultar pregunta y verificar distancias de nuevo
      setTimeout(() => {
        questionPanel.style.display = 'none';
        feedback.style.display = 'none';
        if (currentPosition) {
          verificarDistancias(currentPosition.lat, currentPosition.lng);
        }
      }, 3000);
    };
    answersContainer.appendChild(btn);
  });
}

// Inicializar la brújula (orientación del dispositivo)
function initCompass() {
  // Configurar eventos de orientación para la brújula
  if ('DeviceOrientationEvent' in window) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // Safari iOS: requiere permiso del usuario
      const compassMsg = document.getElementById('compassMsg');
      compassMsg.textContent = 'Toca para activar brújula';
      compassMsg.style.display = 'block';
      const compassElem = document.getElementById('compass');
      compassElem.style.cursor = 'pointer';
      compassElem.onclick = async () => {
        try {
          const permiso = await DeviceOrientationEvent.requestPermission();
          if (permiso === 'granted') {
            // Permiso otorgado: iniciar escucha de orientación
            compassMsg.style.display = 'none';
            compassElem.style.cursor = 'default';
            window.addEventListener('deviceorientation', onOrientation, true);
            // Si no se obtienen datos tras un tiempo, mostrar aviso
            setTimeout(() => {
              if (!orientationReceived) {
                compassMsg.textContent = 'Brújula no disponible';
                compassMsg.style.display = 'block';
              }
            }, 5000);
          } else {
            // Permiso denegado
            compassMsg.textContent = 'Brújula no activada';
          }
        } catch (e) {
          console.error('Error al solicitar permisos de orientación:', e);
          compassMsg.textContent = 'Brújula no disponible';
        }
      };
    } else {
      // Otros navegadores (Chrome/Android)
      window.addEventListener('deviceorientation', onOrientation, true);
      // Verificar si se reciben datos; si no, avisar al usuario
      setTimeout(() => {
        if (!orientationReceived) {
          const compassMsg = document.getElementById('compassMsg');
          compassMsg.textContent = 'Brújula no disponible';
          compassMsg.style.display = 'block';
        }
      }, 5000);
    }
  } else {
    // El dispositivo/navegador no soporta orientación
    const compassMsg = document.getElementById('compassMsg');
    compassMsg.textContent = 'Brújula no soportada';
    compassMsg.style.display = 'block';
  }
}

// Manejar evento de orientación del dispositivo para actualizar la brújula
function onOrientation(e) {
  // Calcular rumbo (en grados) respecto al norte
  let heading = e.alpha;
  if (e.webkitCompassHeading !== undefined) {
    // Usar webkitCompassHeading en Safari (valor absoluto)
    heading = e.webkitCompassHeading;
  }
  if (heading === null) return;
  if (e.webkitCompassHeading === undefined && e.absolute === false) {
    // No hay orientación absoluta disponible
    const compassMsg = document.getElementById('compassMsg');
    compassMsg.textContent = 'Brújula no disponible';
    compassMsg.style.display = 'block';
    window.removeEventListener('deviceorientation', onOrientation);
    return;
  }
  orientationReceived = true;
  // Ocultar mensaje de error si estaba visible
  document.getElementById('compassMsg').style.display = 'none';
  // Rotar la flecha de la brújula (invertir el ángulo para que apunte al norte)
  document.getElementById('compassArrow').style.transform = `rotate(${-heading}deg)`;
}

// Iniciar la aplicación una vez cargado el DOM
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await cargarPuntos();
  iniciarGeolocalizacion();
  initCompass();
  // Eventos para mostrar/ocultar la lista de preguntas contestadas
  document.getElementById('toggleAnsweredBtn').onclick = () => {
    document.getElementById('answeredPanel').style.display = 'block';
  };
  document.getElementById('closeAnsweredBtn').onclick = () => {
    document.getElementById('answeredPanel').style.display = 'none';
  };
});

