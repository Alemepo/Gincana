// Lista de preguntas contestadas (IDs) en esta sesión (recuperar de localStorage)
let preguntasContestadas = JSON.parse(localStorage.getItem("preguntasContestadas")) || [];
let aciertos = 0;

// Inicializar el mapa Leaflet y capa base (OpenStreetMap)
let mapa = L.map('map').fitWorld();
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  maxZoom: 19
}).addTo(mapa);

let usuarioMarcador;
let circuloUsuario;
let currentPreguntaId = null; // ID de la pregunta actualmente mostrada

let puntos = []; // Array de puntos de interés (preguntas) cargados

// Cargar preguntas desde 'preguntas.json' y agregar marcadores (excluyendo ya contestadas)
fetch('preguntas.json')
  .then(response => response.json())
  .then(data => {
    data.forEach((q, index) => {
      // Si esta pregunta ya fue contestada en esta sesión, la omitimos
      if (!preguntasContestadas.includes(index)) {
        let marker = L.marker([q.lat, q.lng]).addTo(mapa);
        marker.bindPopup(q.titulo);
        puntos.push({ id: index, latlng: L.latLng(q.lat, q.lng), data: q, marker: marker });
      }
    });
  })
  .catch(err => console.error("Error cargando preguntas:", err));

// Solicitar geolocalización continua y centrar el mapa cuando se obtenga la posición
mapa.locate({ watch: true, setView: true, maxZoom: 18, enableHighAccuracy: true });
mapa.on('locationfound', onLocationFound);
mapa.on('locationerror', () => {
  console.error("Geolocalización fallida.");
});

// Objeto para almacenar el punto más cercano en cada actualización
let currentNearest = { punto: null, dist: Infinity };

// Manejar nueva ubicación del usuario
function onLocationFound(e) {
  const userLatLng = e.latlng;

  // Actualizar o crear marcador de usuario
  if (!usuarioMarcador) {
    usuarioMarcador = L.marker(userLatLng).addTo(mapa).bindPopup("Tú").openPopup();
  } else {
    usuarioMarcador.setLatLng(userLatLng);
  }
  // Actualizar o crear círculo de 50m alrededor del usuario
  if (!circuloUsuario) {
    circuloUsuario = L.circle(userLatLng, {
      radius: 50,
      color: 'blue',
      fillColor: '#add8e6',
      fillOpacity: 0.2
    }).addTo(mapa);
  } else {
    circuloUsuario.setLatLng(userLatLng);
  }

  // Calcular distancia al punto más cercano
  currentNearest = { punto: null, dist: Infinity };
  puntos.forEach(p => {
    let d = userLatLng.distanceTo(p.latlng);
    if (d < currentNearest.dist) {
      currentNearest = { punto: p, dist: d };
    }
  });

  // Según la distancia, mostrar pregunta o mensaje
  if (currentNearest.punto && currentNearest.dist <= 50) {
    // Dentro de 50m: mostrar pregunta
    hideMessage();
    if (currentPreguntaId !== currentNearest.punto.id) {
      showQuestion(currentNearest.punto);
    }
  } else if (currentNearest.punto && currentNearest.dist <= 500) {
    // Entre 50m y 500m: mostrar mensaje de cercanía
    showMessage(`¡Punto cercano: a ${Math.round(currentNearest.dist)} metros!`);
    hideQuestion();
  } else {
    // Más de 500m: ocultar todo
    hideMessage();
    hideQuestion();
  }
}

// Mostrar mensaje informativo
function showMessage(msg) {
  let msgDiv = document.getElementById('message');
  msgDiv.textContent = msg;
  msgDiv.classList.add('visible');
}
// Ocultar mensaje
function hideMessage() {
  document.getElementById('message').classList.remove('visible');
}

// Mostrar la pregunta (y opciones) en pantalla
function showQuestion(punto) {
  currentPreguntaId = punto.id;
  let box = document.getElementById('question-box');
  let preguntaElem = document.getElementById('question-text');
  let feedbackElem = document.getElementById('feedback');

  // Establecer texto de la pregunta
  preguntaElem.textContent = punto.data.pregunta;
  feedbackElem.textContent = "";

  // Preparar respuestas (mezclar orden)
  let respuestas = [
    punto.data.respuestas.correcta,
    ...punto.data.respuestas.incorrectas
  ];
  shuffle(respuestas);

  // Asignar texto a los botones de respuesta
  document.getElementById('answer1').textContent = respuestas[0];
  document.getElementById('answer2').textContent = respuestas[1];
  document.getElementById('answer3').textContent = respuestas[2];

  // Eventos de click en respuestas
  document.getElementById('answer1').onclick = () => checkAnswer(punto, respuestas[0]);
  document.getElementById('answer2').onclick = () => checkAnswer(punto, respuestas[1]);
  document.getElementById('answer3').onclick = () => checkAnswer(punto, respuestas[2]);

  // Mostrar cuadro de pregunta con animación
  box.classList.add('visible');
}

// Ocultar cuadro de pregunta
function hideQuestion() {
  let box = document.getElementById('question-box');
  box.classList.remove('visible');
  currentPreguntaId = null;
}

// Procesar la respuesta seleccionada
function checkAnswer(punto, respuestaSeleccionada) {
  let feedbackElem = document.getElementById('feedback');
  if (respuestaSeleccionada === punto.data.respuestas.correcta) {
    // Respuesta correcta
    feedbackElem.textContent = "¡Correcto!";
    aciertos++;
    document.getElementById('score').textContent = `Aciertos: ${aciertos}`;
    // Registrar respuesta correcta (ocultar punto permanentemente)
    preguntasContestadas.push(punto.id);
    localStorage.setItem("preguntasContestadas", JSON.stringify(preguntasContestadas));
    mapa.removeLayer(punto.marker);
    // Eliminar punto del array activo
    puntos = puntos.filter(p => p.id !== punto.id);
    // Ocultar pregunta después de breve pausa para mostrar feedback
    setTimeout(() => {
      hideQuestion();
      feedbackElem.textContent = "";
    }, 1000);
  } else {
    // Respuesta incorrecta
    feedbackElem.textContent = `Incorrecto. La respuesta correcta es: ${punto.data.respuestas.correcta}`;
  }
}

// Función para mezclar aleatoriamente un array (Fisher–Yates)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Actualizar la brújula según la orientación del dispositivo
window.addEventListener('deviceorientation', (event) => {
  if (!currentNearest.punto) return; // No hay objetivo
  let heading;
  if (event.webkitCompassHeading) {
    // En iOS Safari
    heading = event.webkitCompassHeading;
  } else if (event.absolute && event.alpha != null) {
    // En Android/otros navegadores
    heading = event.alpha;
  } else {
    // Fallback
    heading = event.alpha || 0;
  }
  // Calcular rumbo (bearing) desde el usuario al punto más cercano
  let lat1 = usuarioMarcador.getLatLng().lat * Math.PI / 180;
  let lon1 = usuarioMarcador.getLatLng().lng * Math.PI / 180;
  let lat2 = currentNearest.punto.latlng.lat * Math.PI / 180;
  let lon2 = currentNearest.punto.latlng.lng * Math.PI / 180;
  let y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  let x = Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  // Rotar flecha: diferencia entre rumbo y orientación del dispositivo
  let angle = bearing - heading;
  document.getElementById('compass').style.transform = `translateX(-50%) rotate(${angle}deg)`;
});


