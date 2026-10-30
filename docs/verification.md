# Verificación de la primera versión

Fecha de trabajo: 29 de octubre de 2026, America/Lima. Los registros de máquina usan UTC.

## Verificación del proyecto

- Node.js 24.18.0 y Codex CLI 0.160.0 disponibles en el entorno de prueba.
- 31 pruebas del arnés pasaron; incluyen un servidor MCP de prueba por STDIO.
- `npm audit --audit-level=low`: ninguna vulnerabilidad reportada para el lockfile comprobado.
- Las tres skills locales pasaron el validador estructural de skills.
- Handshake con el servidor oficial `drawio-mcp 1.10.0` por STDIO y `drawio-mcp-app 1.4.1` por Streamable HTTP. Se consultaron herramientas y referencia; no son mocks.
- El recorrido Mermaid de entrada se publicó por el MCP local y se inspeccionó en Draw.io, incluyendo sus alternativas de caché y respuestas. Ese ejemplo es ilustrativo, no un resultado atribuido al servicio Quarkus.

## Prueba con fuentes públicas

Repositorio: [quarkusio/quarkus-super-heroes](https://github.com/quarkusio/quarkus-super-heroes), revisión `e195d0a36d6d863213bbfe527db64cb51b3637f5`, licencia Apache-2.0. Alcance: directorio `rest-fights`.

El inventario encontró 12 endpoints, incluidos los definidos por OpenAPI e implementados mediante interfaces generadas. La auditoría conserva huella de fuentes y selección de contexto. La primera pasada incluyó todas las variantes de despliegue; las siguientes usan contexto core. No se ejecutó el microservicio ni se desplegó infraestructura.

El primer ensayo reveló que los puntos y coma de notas Mermaid debían escaparse. El arnés ahora hace esa transformación de puntuación, la registra y puede recuperar candidatos que pasan el resto de validaciones. La prueba también motivó agrupar recursos por definiciones enlazadas por evidencia, evitando duplicarlos por diferencias en las descripciones del modelo.

La ejecución terminó con **12 de 12 entradas analizadas, sin bloqueadas**. Generó el informe, 12 documentos de flujo, 12 secuencias Mermaid, CSV de cobertura/evidencia, mapa Mermaid y Draw.io editable. Una reanudación posterior volvió a validar resultados y regeneró los entregables sin invocar de nuevo al motor de IA.

El mapa se publicó por `open_drawio_mermaid` en el MCP oficial y se inspeccionó visualmente en el editor: un servicio de entrada, seis destinos lógicos (MongoDB, Kafka, Heroes, Villains, Narration y Locations) y seis conectores. Los detalles y condiciones permanecen en las vistas por endpoint. El registro distingue el enlace devuelto por MCP, el archivo Draw.io generado localmente y la inspección visual posterior.

Los resultados están en `runs/rest-fights/`. `progress.md` y `state.json` son la autoridad sobre su estado; la evidencia, las secuencias y `publication.json` permiten inspeccionarla. La validación automática de una cita o un diagrama no sustituye la revisión semántica ni demuestra ejecución real en producción.
# Selector de diagramas y plantillas

Ampliación verificada con el mismo snapshot de `rest-fights`, sin repetir llamadas al modelo: integración por capas en XML editable (13 páginas: general y 12 endpoints) y C4Container en Mermaid, ambos enviados mediante MCP real. Se inspeccionaron las vistas en el editor y la página POST /api/fights con MongoDB y Kafka. El mapa global requiere zoom; las páginas por endpoint permiten leer relaciones sin saturar una sola vista.

El menú de terminal se comprobó con una PTY real: elección múltiple 2,3 y orientación TB. Las pruebas cubren selección explícita, falta de elección sin terminal, persistencia tras fallo, reanudación, orientación LR, páginas XML, separación de endpoints/C4, hashes de vistas/selección y elección de herramienta MCP XML. La suite ampliada contiene 36 pruebas. El frontmatter de las tres skills se validó con el parser YAML del proyecto; el validador Python del sistema no pudo ejecutarse porque su runtime no incluye PyYAML.
