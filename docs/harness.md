# Arquitectura y controles del arnés

## Componentes

1. **Descubrimiento determinista:** parsea Java con CST y OpenAPI con AST YAML. Separa clientes salientes de recursos REST, registra consumidores/jobs y combina evidencia por método/path. `operationId` propone implementaciones candidatas para interfaces generadas.
2. **Motor del agente:** Codex CLI en modo no interactivo, sandbox read-only y salida JSON Schema. Se incorporan las skills locales y las fuentes numeradas al prompt. El modelo es el que configura la instalación de Codex; el proyecto no fija uno ni administra credenciales.
3. **Coordinador:** objetivos por entrada, lotes secuenciales, escritura atómica, exclusión mutua de ejecuciones y un máximo de dos intentos cuando la respuesta incumple validación. Fallos de autenticación/motor/timeout no se reintentan automáticamente.
4. **Validación:** contrato, IDs únicos, cobertura, destinos alcanzables, referencias, archivos del inventario, hashes, intervalos, citas literales, asociación entre paso y mensaje Mermaid y parser Mermaid real.
5. **Entregables:** Markdown/CSV, Mermaid por entrada, mapa agregado y XML Draw.io editable. Las respuestas parciales conservan trabajo válido.
6. **Entrega:** archivos portátiles por defecto, puente local opcional y cliente MCP opcional. El puente usa un puerto loopback efímero, ruta aleatoria, origen/ventana verificados y confirmación de carga; no sirve el filesystem. El MCP negocia handshake, catálogo y esquemas, consulta referencia, realiza la llamada y registra el resultado. La entrega de auditorías exige cobertura seleccionada completa. Los hashes cubren también el paquete XML multipágina.

## Estados y reanudación

Cada entrada puede estar pending → running → analyzed, blocked o failed. La ejecución termina complete, partial o failed. Al reanudar se comprueban fuente, alcance e instrucciones y se vuelven a validar resultados completados. Un resultado bloqueado se conserva como tal; si cambia el código o el alcance se crea una ejecución nueva.

`analyzed` significa que el resultado pasó las comprobaciones del arnés. No significa ejecución observada ni ausencia de fallos en el microservicio. `complete` se refiere al inventario seleccionado; las advertencias del descubridor siguen aplicando.

La huella cubre archivos de fuente incluidos, con revisión Git y modificaciones versionadas como contexto adicional. Los archivos excluidos y las rutas dinámicas no quedan cubiertos por esa huella. El arnés no considera un simple cambio en un archivo excluido como evidencia de un recorrido nuevo.

El inventario de archivos y el contexto enviado al motor son distintos. `core` selecciona `src/main` y descriptores de build; `all` incluye los demás archivos inventariados. El inventario registra la última selección y los modos usados, y `events.jsonl` conserva la selección por pasada. Cambiar entre esos modos al reanudar es una estrategia explícita de contexto sobre el mismo snapshot, sin invalidar resultados ya verificados; no autoriza conclusiones sobre fuentes no incluidas.

## Límites de confianza

- Los archivos del objetivo se consideran datos, incluidas sus instrucciones para agentes. El prompt prohíbe ejecutar herramientas/código del objetivo y el ejecutor pide sandbox read-only. Esto reduce riesgos, pero no es una demostración formal de aislamiento ni una política de red.
- Se omiten enlaces simbólicos, directorios de build/tests y archivos con nombres de credenciales. Otros archivos de configuración pueden contener valores sensibles: selecciona el alcance que tu entorno permita enviar al modelo.
- La validación comprueba que el fragmento citado existe, no que justifique lógicamente toda la afirmación. La revisión semántica sigue siendo necesaria.
- Una entrada de contrato sin implementación candidata no puede declararse analizada; queda bloqueada hasta resolver el handler. Las rutas anotadas directamente priorizan su propio método frente a coincidencias de nombre.
- Un `.drawio` local válido, un MCP conectado y un diagrama visualmente inspeccionado son evidencias distintas.
- La ausencia de Redis/RDS/Kafka en el análisis no prueba ausencia universal; no se inventan tecnologías ni infraestructura de despliegue.

## Evaluación

`npm test` prueba descubrimiento sin falsos positivos de comentarios, contratos generados, exclusión de clientes/tests, evidencia falsa, rutas ajenas, cobertura faltante, destinos no usados, Mermaid inválido, reanudación, cambios de código, bloqueo de ejecuciones y fallos MCP. Los tests usan un servidor MCP de prueba real por STDIO, además de la comprobación manual con el servidor oficial.

El ejemplo público sirve para evaluar comportamiento semántico del agente. No se ejecutan sus pruebas Quarkus ni se despliegan sus dependencias.

El mapa agrega clientes REST/gRPC, entidades y canales cuando una definición Java enlazada por evidencia demuestra una identidad única. No usa solo el texto que el modelo dio al destino ni agrupa indiscriminadamente bases de datos por tecnología. Si la identidad es ambigua, conserva destinos separados.

En el mapa general, las líneas discontinuas identifican mensajería y las continuas muestran APIs/datos/caché. Un Uni o una llamada de I/O no bloqueante no convierte automáticamente una consulta en un evento fire-and-forget. La espera de resultados, confirmaciones y el orden se explican en las secuencias y en la documentación por entrada.

Las etiquetas de secuencia escapan puntos y coma como la entidad Mermaid `#59;`: sin ese escape el parser puede interpretarlos como separadores de sentencias. El arnés registra esta transformación de puntuación; no cambia participantes, mensajes, ramas ni orden. Al reanudar puede recuperar una respuesta rechazada si ese escape basta para que pase todas las comprobaciones de evidencia y estructura.
