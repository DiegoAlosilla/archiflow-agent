# Archivos, editor local y MCP

ArchiFlow y Draw.io son proyectos independientes. El contrato entre ambos es un archivo XML `.drawio` estándar. No hace falta fusionar repositorios, instalar el auditor dentro del editor ni disponer de MCP para generar o abrir diagramas.

## Elegir la entrega

| Modo | Comportamiento | Requisito adicional |
|---|---|---|
| `--delivery files` | Escribe Mermaid y `.drawio`; no abre navegador ni inicia MCP | Ninguno |
| `--delivery local` | Escribe los mismos archivos y los carga en un editor loopback | Draw.io local iniciado y compatible con embed JSON |
| `--delivery mcp` | Escribe archivos y llama al servidor MCP configurado | Servidor con herramienta XML compatible |

El agente de chat pregunta tipo, orientación y entrega si no se indicaron; respeta elecciones anteriores. La terminal interactiva pregunta la entrega, con archivos como opción recomendada. En automatización, la entrega omitida es `files`. `--publish` es alias de `--delivery mcp`; combinarlo con otro modo falla antes del análisis. `publish` es el comando explícito para MCP. El modo de entrega no se hereda silenciosamente al reanudar: así no se vuelve a abrir/publicar sin indicarlo.

## Generar y abrir manualmente

```powershell
node src/cli.js audit --repo "D:\repos\servicio" --out runs/servicio --diagram-type integration,c4-container,sequence --direction TB --delivery files
# Cambiar vistas sin volver a analizar con IA
node src/cli.js render --run runs/servicio --diagram-type integration,c4-container,sequence,dependencies --delivery files
```

Abre `diagrams.drawio` con **Archivo → Abrir desde → Dispositivo** en [Draw.io original](https://app.diagrams.net/), arrástralo a tu editor local o usa Draw.io Desktop. El paquete contiene las vistas elegidas como páginas; en secuencia hay una por endpoint. También quedan los `.drawio` individuales en `views/`, los `.mmd` y la documentación. El XML usa figuras y conectores editables, sin imágenes remotas ni plugins obligatorios.

Guarda tus cambios de presentación en otra copia: modificar el original invalida su hash de auditoría. `render` exige las fuentes originales y una auditoría completa validada.

## Abrir automáticamente en el fork local

En una terminal, desde el proyecto del editor:

```powershell
cd D:\DrawIo
npm start
```

El bootstrap del editor puede necesitar Internet al instalarse por primera vez; consulta su propia documentación para preparar el equipo. ArchiFlow no instala ni arranca automáticamente ese proyecto.

En otra terminal, desde ArchiFlow:

```powershell
cd D:\ArchiFlowAgent
node src/cli.js render --run runs/rest-fights --diagram-type integration,c4-container,sequence --delivery local --editor-url http://127.0.0.1:8080/
```

El adaptador comprueba disponibilidad, crea un puente HTTP efímero en `127.0.0.1` y abre el navegador predeterminado. Carga XML mediante el protocolo `postMessage` de Draw.io (`init` → `load` → confirmación), validando origen y ventana. El contenido no va en la URL. Solo sirve esa página con una ruta aleatoria; no sirve el repositorio ni directorios del equipo. El puente se cierra al confirmar carga o al cumplirse 60 segundos. Recargar la página del puente después de cerrarlo requiere ejecutar de nuevo el comando; el editor ya cargado sigue funcionando mientras su servidor local esté disponible.

El botón **Guardar** descarga una copia `ArchiFlow-editado.drawio`. No sobrescribe el archivo auditado. `delivery.json` registra la confirmación de carga; no afirma inspección visual ni guardado. Si el editor no está disponible o no confirma carga, el comando falla conservando los archivos y no recurre a la web pública. Solo se admiten URLs loopback para este modo.

Probado con el fork local basado en Draw.io 32.4.1. Otros forks deben conservar el protocolo embed JSON y permitir ser enmarcados desde el puente local. La entrega manual por archivo no depende de ese protocolo.

## Mermaid como entrada

```powershell
node src/cli.js diagram --mermaid examples/cache-aside.mmd --out runs/mermaid-local --delivery files
```

Produce `diagram.mmd`, `diagram.drawio` y metadatos de origen. No acredita una auditoría de código. La sintaxis la valida Mermaid 12.2.0 y el exportador usa su árbol interpretado; no define otro lenguaje.

La conversión nativa cubre las cuatro vistas generadas por el auditor. Para Mermaid externo admite secuencias con mensajes habituales, notas, activaciones, numeración, cajas de participantes y bloques anidados `alt`, `opt`, `loop`, `par`, `critical`, `break` y `rect`; flowcharts con figuras básicas y relaciones; C4Container de contenedores, almacenes y colas, sin fronteras. Conserva etiquetas y relaciones, normalizando estilos y disposición.

Todavía rechaza subgraphs externos, fronteras/personas C4, creación/destrucción dinámica de participantes y flechas especializadas de secuencia. Ante una construcción no soportada conserva el Mermaid de entrada y falla antes de entregar un XML simplificado. Una sintaxis Mermaid válida no garantiza que toda su notación tenga equivalente implementado aquí.

## MCP opcional

```powershell
node src/cli.js mcp-check
node src/cli.js render --run runs/servicio --diagram-type integration,sequence --delivery mcp
```

`doctor` no conecta a MCP salvo `--check-mcp`. La dependencia del servidor sigue fijada en el paquete para quienes la usen, pero no se inicia en modos `files` o `local`. Las nuevas vistas usan `open_drawio_xml`; un servidor que solo expone Mermaid no puede publicarlas con este estilo. Consulta [configuración MCP](mcp.md).

La entrega local es independiente del análisis por IA: Codex sigue siendo el motor configurado. Elegir un editor local no convierte al modelo de análisis en un modelo local.
