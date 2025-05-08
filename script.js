let puntos = [];
fetch('preguntas.json')
  .then(res => res.json())
  .then(data => {
    // Guardar puntos de interés con una marca de respuesta no entregada
    puntos = data.map(p => ({ ...p, respondido: false }));
  })
  .catch(err => console.error('Error cargando preguntas:', err));
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
// Marcador que representará la posición del usuario
let userMarker = L.marker([0, 0]).addTo(map);
if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(onPositionUpdate, onError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 5000
  });
} else {
  alert('Geolocalización no soportada en este navegador.');
}
function onPositionUpdate(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  // Mover el marcador del usuario y centrar el mapa aquí
  userMarker.setLatLng([lat, lng]);
  map.setView([lat, lng], 16); // zoom 16 para cercanía

  // Calcular distancia al punto de interés más cercano
  let distanciaMin = Infinity;
  let puntoCercano = null;
  puntos.forEach(p => {
    const d = L.latLng(lat, lng).distanceTo([p.lat, p.lng]); // en metros:contentReference[oaicite:6]{index=6}
    if (d < distanciaMin) {
      distanciaMin = d;
      puntoCercano = p;
    }
  });

  const infoDiv = document.getElementById('info');
  if (distanciaMin <= 500 && puntoCercano) {
    infoDiv.textContent = `Estás a ${Math.round(distanciaMin)} metros de un punto de interés.`;
  } else {
    infoDiv.textContent = '';
  }

  // Si está muy cerca (<50 m) y la pregunta no ha sido respondida, mostrar la pregunta
  if (puntoCercano && distanciaMin <= 50 && !puntoCercano.respondido) {
    mostrarPregunta(puntoCercano);
  }
}
function mostrarPregunta(punto) {
  const infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `<strong>${punto.pregunta}</strong><br>`;
  // Mezclar respuestas: correcta + incorrectas
  const opciones = [punto.respuestas.correcta, ...punto.respuestas.incorrectas];
  opciones.sort(() => Math.random() - 0.5); // mezclar array

  // Crear botones para cada respuesta
  opciones.forEach(op => {
    const btn = document.createElement('button');
    btn.textContent = op;
    btn.onclick = () => {
      if (op === punto.respuestas.correcta) {
        alert('¡Respuesta correcta!');
      } else {
        alert('Respuesta incorrecta.');
      }
      // Marcar como respondido y limpiar la pregunta
      punto.respondido = true;
      infoDiv.textContent = '';
    };
    infoDiv.appendChild(btn);
  });
}
