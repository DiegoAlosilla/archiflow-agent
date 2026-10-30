# ArchiFlow Scan: propuesta de primera versión

Fecha: 29 de octubre de 2026.

## Decisión

Mermaid estándar para diagramación, Markdown/CSV para documentación y evidencia, MCP de Draw.io para representación visual. Separar análisis y representación permite revisar hallazgos y conectar otro editor más adelante sin crear un lenguaje propio.

La skill dirige la ingeniería inversa del agente sobre código accesible; no es un CLI ni un analizador AST universal.

## Comparación investigada

| Opción | Utilidad | Decisión propuesta |
|---|---|---|
| Mermaid flowchart + sequenceDiagram | Dependencias y orden con alternativas, bucles y paralelos | Predeterminado de v1 |
| Mermaid architecture-beta | Infraestructura agrupada | Vista adicional si aporta claridad y hay compatibilidad |
| PlantUML | Secuencias UML expresivas | Evitar un segundo motor sin necesidad concreta |
| Structurizr DSL / C4 | Modelo compartido, varias vistas y relaciones dinámicas ordenadas | Evaluar al mantener un catálogo entre muchos servicios |
| XML nativo Draw.io | Páginas, metadatos y presentación editable | Complemento cuando Mermaid no conserve lo requerido |

Son recomendaciones para este alcance, no resultados de un benchmark. C4 aporta abstracciones y XML aporta representación: no reemplazan el análisis de código.

Fuentes: [Mermaid flowchart](https://mermaid.js.org/syntax/flowchart.html), [secuencias](https://mermaid.js.org/syntax/sequenceDiagram.html), [arquitectura](https://mermaid.js.org/syntax/architecture.html), [PlantUML](https://plantuml.com/sequence-diagram), [Structurizr DSL](https://docs.structurizr.com/dsl), [vista dinámica](https://docs.structurizr.com/dsl/cookbook/dynamic-view/), [generación Draw.io](https://www.drawio.com/docs/reference/diagram-generation/).

## Primera versión

1. Identificar aplicación, revisión y configuración.
2. Inventariar entradas antes de analizarlas.
3. Recorrer cada entrada hasta fronteras accesibles, siguiendo condiciones y saltos a servicios, caché, datos y eventos.
4. Registrar evidencia con archivo/líneas y distinguir código observado, ejecución observada, inferencia y desconocidos.
5. Generar documentación, mapa general y secuencias por entrada; conservar progreso para reanudar.
6. Validar, llamar al MCP e inspeccionar los resultados disponibles.

La cobertura debe listar analizadas, bloqueadas y excluidas. «Todas las entradas descubiertas están documentadas» no demuestra descubrir registros dinámicos ni explorar todas las combinaciones posibles.

Para «qué no hace», conservar límites del análisis. Una dependencia instalada no demuestra uso; no encontrar una integración no prueba su ausencia universal.

## Animación y evolución

Draw.io sí dispone de animación de conectores. Eso ilustra dirección, pero no demuestra un recorrido condicional correcto. La v1 puede entregarse con vistas estáticas y evaluar animación después. [Fuente oficial](https://www.drawio.com/docs/manual/connectors/connector-animate/).

En v2, contrastar análisis con trazas OpenTelemetry existentes y crear un adaptador al editor propio. Cada traza respalda una ejecución particular, no cobertura exhaustiva. [OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/traces/).

Si el proyecto propio es un fork compatible del editor, evaluar `DRAWIO_BASE_URL` antes de construir otro MCP. Si es una aplicación diferente, necesitará integración específica. [Configuración oficial](https://github.com/jgraph/drawio-mcp/blob/main/mcp-tool-server/README.md#self-hosted-drawio).

## Estado de entrega

Skill inicial en `skills/archiflow-scan/`, con contrato de entregables e integración MCP. La validación estructural de la skill no sustituye probarla contra un microservicio.

La carpeta de trabajo no contenía un microservicio y la sesión no exponía herramientas Draw.io. No se ejecutó un escaneo ni se verificó renderizado/publicación MCP. La prueba integral necesita código accesible y conexión MCP disponible.
