# Elegir diagramas

Una auditoría conserva los mismos hallazgos y permite diferentes presentaciones. El agente pregunta la vista en chat cuando no se indicó; la terminal interactiva presenta un menú. La elección puede combinar vistas y se guarda en `presentation.json`. Al reanudar se reutiliza la elección; para cambiarla sin repetir el análisis usa `render`.

| Opción CLI | Nombre | Uso |
|---|---|---|
| `integration` | Integración por capas | Endpoint → destinos. Componentes amarillos, almacenes y flechas ortogonales; inspirada en creditos.xml. |
| `c4-container` | C4 de contenedores | Aplicaciones y almacenes observados; vista parcial, sin límites de sistema inventados. |
| `sequence` | Secuencia por endpoint | Orden, condiciones, paralelismo y fallos de cada petición. |
| `dependencies` | Mapa de dependencias | Resumen del servicio y recursos alcanzables. |

El adjunto creditos.xml se interpretó como un diagrama de integración con notación de componentes UML: `shape=module`, agrupaciones `umlFrame`, roles API/MS y conectores ortogonales. «Integración por capas» es el nombre de nuestra plantilla, no un estándar formal. Esta primera plantilla adapta las figuras, colores y orientación; no reproduce exactamente todas las agrupaciones del proyecto ni inventa roles UX/BS. Los datos del adjunto no se incorporan a otros servicios.

`TB` ordena de arriba abajo; `LR`, de izquierda a derecha. En integración las capas son servicio, endpoints y destinos; su posición no afirma que las dependencias se invoquen en ese orden. En C4 la orientación guía relaciones, pero el motor Mermaid controla el layout final. La secuencia siempre conserva tiempo hacia abajo y participantes en horizontal.

## Ejemplos

```powershell
# Terminal interactiva: pregunta tipos y orientación antes del análisis
node src/cli.js audit --repo "D:\repos\servicio" --out runs/servicio

# Elección explícita, también para automatización o herramientas de chat
node src/cli.js audit --repo "D:\repos\servicio" --out runs/servicio --diagram-type integration,sequence --direction TB --publish

# Mismos hallazgos, otra vista; no vuelve a llamar al modelo
node src/cli.js render --run runs/rest-fights --diagram-type c4-container --direction LR
node src/cli.js publish --run runs/rest-fights

node src/cli.js diagram-types
```

Fuera de una terminal interactiva, omitir `--diagram-type` produce un mensaje que pide la selección. El agente de chat debe preguntar al usuario y pasar su respuesta en los argumentos. No se escoge una plantilla por defecto silenciosamente. Si se indica el tipo pero se omite dirección, se usa TB. Para secuencias no se pregunta orientación.

## Archivos y publicación

- `views/integration.drawio`: componentes nativos editables; vista general y una página por endpoint. Las etiquetas resumen las relaciones y los tooltips conservan operaciones/condiciones completas. Se publica con `open_drawio_xml`.
- `views/integration.mmd`: equivalente de relaciones en Mermaid; las figuras de componente se simplifican.
- `views/c4-container.mmd`: sintaxis Mermaid `C4Container`.
- `views/dependencies.mmd`: mapa de dependencias con orientación elegida.
- `flows/*.sequence.mmd`: detalle por endpoint.

`publish` usa solo la selección vigente. `--all-diagrams` añade las secuencias. Los archivos de vistas anteriores pueden permanecer en disco, pero ya no forman parte de la selección. El informe base y sus secuencias siguen disponibles para consulta. Los hashes de las nuevas vistas y de la selección se comprueban antes de publicar. Cambiar de vista requiere fuentes originales sin modificaciones y una auditoría completa validada.

Para conservar figuras de integración usa el MCP STDIO incluido. Un servidor HTTP que exponga únicamente `create_diagram` no admite la publicación XML de esta plantilla; el cliente informa la incompatibilidad antes de publicar el lote.

## Alcance C4

C4 tiene varios niveles. Esta versión implementa únicamente una vista parcial de contenedores: un endpoint es una operación, no un contenedor. Un repositorio aislado no permite deducir fronteras empresariales, propietarios, usuarios externos o todos los componentes internos. No se añaden personas ni límites de sistema sin esa información. Contexto C4 y componentes C4 quedan pendientes de un modelo de alcance más amplio.

Referencias: [definición oficial de contenedores](https://c4model.com/diagrams/container), [niveles de C4](https://c4model.com/diagrams), [sintaxis C4 de Mermaid](https://mermaid.js.org/syntax/c4.html). La sintaxis C4 de Mermaid es experimental; el proyecto valida con su versión fijada, y la compatibilidad de representación depende también del Mermaid incluido en Draw.io.
