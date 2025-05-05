let map = L.map('map').setView([38.7368, 0.1065], 13); // Vista inicial por defecto
let userMarker = null;
let marcadores = [];
let preguntaMostrada = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// Cargar marcadores desde preguntas.json
fetch('preguntas.json')  // 👉 Si usas una URL pública, reemplaza aquí
  .then(res => res.json())
  .then(data => {
    marcadores = data.map(item => {
      const marker = L.marker([item.lat, item.lng]).addTo(map);
      marker.bindPopup(item.titulo);
      return { ...item, _marker: marker };
    });
  });

// Función llamada cada vez que cambia la ubicación del usuario
function actualizarUbicacion(lat, lng) {
  if (!userMarker) {
    userMarker = L.marker([lat, lng], { color: 'blue' }).addTo(map);
    userMarker.bindPopup("Estás aquí").openPopup();
    map.setView([lat, lng], 17);
  } else {
    userMarker.setLatLng([lat, lng]);
  }

  let marcadorCercano = null;
  let distanciaMinima = Infinity;

  marcadores.forEach(m => {
    const distancia = map.distance([lat, lng], [m.lat, m.lng]);
    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      marcadorCercano = m;
    }
  });

  const info = document.getElementById('info');
  if (marcadorCercano && distanciaMinima <= 50) {
    info.textContent = `A ${distanciaMinima.toFixed(1)} m de: ${marcadorCercano.titulo}`;
  } else {
    info.textContent = '';
  }

  if (marcadorCercano && distanciaMinima <= 15) {
    mostrarPregunta(marcadorCercano);
  }
}

function mostrarPregunta(marcador) {
  if (preguntaMostrada === marcador) return; // Ya está mostrada
  preguntaMostrada = marcador;

  const panel = document.getElementById('question');
  const texto = document.getElementById('question-text');
  const respuestas = document.getElementById('answers');

  texto.textContent = marcador.pregunta;
  respuestas.innerHTML = '';

  const opciones = [marcador.respuestas.correcta, ...marcador.respuestas.incorrectas];
  opciones.sort(() => Math.random() - 0.5); // Mezclar opciones

  opciones.forEach(opcion => {
    const btn = document.createElement('button');
    btn.textContent = opcion;
    btn.onclick = () => {
      if (opcion === marcador.respuestas.correcta) {
        alert('✅ ¡Correcto!');
      } else {
        alert('❌ Incorrecto.');
      }
      panel.classList.add('hidden');
    };
    const li = document.createElement('li');
    li.appendChild(btn);
    respuestas.appendChild(li);
  });

  panel.classList.remove('hidden');
}

// Activar geolocalización
if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    actualizarUbicacion(lat, lng);
  }, err => {
    alert('No se pudo obtener tu ubicación.');
    console.error(err);
  }, {
    enableHighAccuracy: true,
    maximumAge: 0
  });
} else {
  alert('Tu navegador no permite geolocalización.');
}
