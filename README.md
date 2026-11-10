# Demo Day 2026 · Sistema de evaluación por QR

Web estática (HTML + JS, sin compilar) que implementa la *Guía de evaluación* y la *Guía Operativa Demo Day Expo*:

- **Cada equipo tiene un QR distinto** → abre la página del proyecto (integrantes, grupo, categoría) con la rúbrica de 100 pts, las 3 nominaciones Sí/No y las 4 preguntas de retroalimentación.
- **Voto del público:** un **QR general** (`#/voto`, botón *QR del voto del público* en Equipos y QR; también sale en la hoja impresa) donde estudiantes y asistentes eligen su proyecto favorito.
- **Panel de administrador** (`#/admin`): ganadores, estadísticas, puntos de mejora por equipo, observaciones, cobertura de jueces, equipos/QR y ajustes.

## Premios (según el PDF)

| Premio | Cómo se calcula | Desempate sugerido |
|---|---|---|
| Mejor Idea de Negocio | Mayor **promedio** del total (/100) | Si empatan exacto, se marca *empate sin resolver* para deliberación docente |
| Mejor Defensa en Stand | Más nominaciones «Sí» | Promedio en «Calidad de la Defensa», luego promedio total |
| Proyecto Más Innovador | Más nominaciones «Sí» | Promedio en «Innovación», luego promedio total |
| Mejor Prototipo | Más nominaciones «Sí» | Promedio en «Desarrollo del Prototipo», luego promedio total |
| Premio del Público | Más **votos** del QR general (1 por dispositivo, se puede cambiar mientras esté abierto) | Promedio total de la rúbrica |

Cada premio muestra el ganador general, el top 5 y el ganador **por categoría** (Salud y Bienestar, Tecnología, Educación, Servicios, Sustentabilidad).

**Puntos de mejora por equipo:** cada criterio se compara contra su máximo: ≥ 90 % fortaleza · 80–89 % bien · 60–79 % *por mejorar* · < 60 % *punto crítico*; además se compara contra el promedio del evento y se muestra cuántos jueces dieron cada nivel. Debajo aparecen las observaciones de los jueces agrupadas por área.

## Evento sin internet: servidor en tu computadora (red local)

No necesitas Firebase ni hosting. `serve.ps1` sirve la página **y guarda los datos** (en `data.json`) para que todos los celulares conectados a la misma red compartan evaluaciones y votos.

1. **Red:** conecta la computadora y los celulares a la misma red. Si no hay router/Wi-Fi del lugar, activa en Windows **Configuración → Red e Internet → Zona con cobertura inalámbrica móvil** y conecta los celulares a esa red (no necesita internet).
2. **Inicia el servidor**, en PowerShell dentro de esta carpeta:

   ```powershell
   powershell -ExecutionPolicy Bypass -File serve.ps1
   ```

   La ventana muestra las direcciones para los celulares (ej. `http://192.168.137.1:8080/`) y el **PIN de administrador**. La primera vez, Windows pregunta por el Firewall: **permite el acceso en redes privadas**. Si no preguntó y los celulares no cargan, ejecuta una vez `abrir-firewall.ps1` (pide permisos de administrador y abre el puerto en todas las redes):

   ```powershell
   powershell -ExecutionPolicy Bypass -File abrir-firewall.ps1
   ```
3. En la computadora abre <http://localhost:8080/#/admin>, entra con el PIN y ve a **Equipos y QR**: los QR usan solos la dirección de tu red (con la zona inalámbrica de Windows es `192.168.137.1`). Si tus celulares están en otra red, pulsa **Usar …** con la otra dirección. Importa los equipos e imprime los QR.
4. **Prueba antes de imprimir:** en el navegador del celular escribe a mano la dirección que muestra el aviso (ej. `http://192.168.137.1:8080/`). Si carga, los QR también.
5. Deja la ventana de PowerShell abierta todo el evento (Ctrl+C la detiene). Los datos se conservan en `data.json` aunque la reinicies; **Ajustes → Borrar todo** los limpia (hazlo antes del evento real si probaste con datos de demostración).

Notas: la computadora debe quedarse encendida y en la misma red; si cambia de red, su dirección cambia y hay que elegirla de nuevo en Equipos y QR (los QR impresos con otra dirección dejan de servir). Para usar otro puerto: `serve.ps1 -Port 9000`; para fijar el PIN: `serve.ps1 -AdminPin 123456`.

## Probar sin servidor (modo demostración)

Abriendo `index.html` desde un servidor estático cualquiera (o un hosting sin API), los datos viven solo en el navegador de cada dispositivo: sirve para ver el diseño. En **Ajustes** puedes **Cargar datos de demostración**.

## Alternativa con internet: Firebase + hosting

1. <https://console.firebase.google.com> → **Agregar proyecto** (plan Spark gratis).
2. **Compilación → Firestore Database → Crear base de datos** (modo producción, región cercana).
3. Pestaña **Reglas** → pega el contenido de `firestore.rules` → **Publicar**.
4. **Compilación → Authentication → Comenzar → Correo/contraseña → Habilitar**. En **Usuarios → Agregar usuario** crea el correo y contraseña del administrador (cualquier usuario creado ahí es administrador; no actives otros proveedores).
5. **Configuración del proyecto → Tus apps → `</>` Web** → registra la app y copia el objeto `firebaseConfig` a `firebase-config.js`.
6. **Publica la carpeta** en cualquier hosting estático (los QR necesitan una dirección pública):
   - Netlify Drop (<https://app.netlify.com/drop>, arrastrar la carpeta), Vercel, GitHub Pages o Firebase Hosting.
   - Después agrega ese dominio en **Authentication → Configuración → Dominios autorizados**.
7. Entra a `https://TU-DOMINIO/#/admin`, inicia sesión y en **Ajustes → URL pública** escribe la dirección publicada (ej. `https://mi-demoday.netlify.app/`).
8. **Equipos y QR → Importar Excel/CSV** (columnas: `Proyecto, Grupo, Categoría, Integrantes, Stand, Descripción`; integrantes separados por `;`; ver `equipos_ejemplo.csv` o **Descargar plantilla**).
9. **Imprimir todos los QR** (hoja con un QR por equipo, 2 por fila) o descarga cada QR en PNG.

Re-importar el mismo Excel actualiza los equipos existentes (mismo proyecto + grupo) **sin cambiar su QR**.

## Día del evento

- Juez escanea el QR → escribe nombre y correo (se recuerdan) → evalúa → «Enviar». Si vuelve a escanear el mismo stand con su correo, se cargan sus respuestas y puede corregirlas (cuenta una sola vez por proyecto).
- **Ganadores** se actualiza en tiempo real. Vigila **Jueces → Participación** para ver qué equipos no tienen evaluaciones.
- Tras el recorrido: **Ajustes → desmarcar «Evaluaciones de jueces abiertas»**. Tras los 20 min de votación del público: desmarcar **«Votación del público abierta»**. **Jueces → Exportar CSV** descarga todo.
- Si cambias `firestore.rules`, vuelve a **publicarlas** en Firebase (incluyen la colección `votes` del voto del público).

## Antes del evento: limpiar las pruebas

En **Ajustes → Datos** (funciona en los tres modos: Firebase, servidor local y demostración):
- **Borrar evaluaciones y votos:** deja los equipos, los QR impresos y los ajustes. Es lo que debes hacer después de probar, justo antes de abrir el evento real.
- **Borrar todo:** elimina además equipos y ajustes (los QR impresos dejan de servir).

Los dos botones piden confirmación y muestran cuántos registros se borrarán.

## Si un celular pierde la señal

Cuando un juez o alguien del público envía una evaluación o un voto y no hay conexión, el envío **se guarda en su teléfono** y se reintenta solo (cada 6 segundos, al volver la señal y al reabrir el sitio). La pantalla muestra «Pendiente de enviar» y cambia a «Enviado» cuando llega. Es seguro reintentar: cada evaluación y voto tiene un identificador fijo, así que un reenvío solo lo sobrescribe. Si el servidor lo rechaza (por ejemplo, evaluaciones cerradas), no se reintenta y se avisa.

## Publicar cambios en GitHub

`publicar-github.ps1` deja el repositorio idéntico a esta carpeta usando la API de GitHub (sirve aunque `git push` esté bloqueado). Requiere `gh auth login` una sola vez:

```powershell
powershell -ExecutionPolicy Bypass -File publicar-github.ps1 -SoloVer      # lista los cambios, sin subir
powershell -ExecutionPolicy Bypass -File publicar-github.ps1 -Mensaje "Qué cambió"
```

Nunca sube `data.json`. GitHub Pages se actualiza en ~1 minuto.

## Archivos

`index.html` · `app.js` (interfaz) · `analytics.js` (promedios, mejoras, ganadores) · `rubric.js` (rúbrica y preguntas, editable) · `store.js` (Firebase / servidor local / demostración) · `outbox.js` (cola de reintentos) · `styles.css` · `demo.js` · `firestore.rules` · `serve.ps1` · `abrir-firewall.ps1` · `publicar-github.ps1` · `vendor/` (QR y lector de Excel, incluidos localmente) · `assets/` (logo e íconos).

## Límites conocidos

- **Servidor local:** el tráfico va sin cifrar (HTTP) dentro de tu red; el PIN y los datos solo son tan privados como la red. Úsalo en una red de confianza (tu zona inalámbrica) y no lo expongas a internet.

- La identidad del juez es nombre + correo sin verificación (decisión del proyecto): evita duplicados, pero no impide que alguien escriba un correo ajeno.
- El voto del público se limita **por dispositivo** (identificador guardado en el navegador): quien borre los datos del navegador o use otro teléfono podría votar otra vez. Para un control estricto habría que pedir correo institucional.
- Los premios por nominaciones «Sí» y por votos favorecen a los equipos que recibieron más evaluaciones o votos; en Estadísticas puedes ver cuántas evaluaciones tiene cada equipo.
- El capital virtual de $100,000 del PDF se quitó a petición del proyecto (no hay premio «Mayor Potencial Comercial»).
