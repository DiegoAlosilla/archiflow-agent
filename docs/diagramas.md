# Elegir diagramas

Una auditoría conserva los mismos hallazgos y permite diferentes presentaciones. El agente pregunta la vista en chat cuando no se indicó; la terminal interactiva presenta un menú. La elección puede combinar vistas y se guarda en `presentation.json`. Al reanudar se reutiliza la elección; para cambiarla sin repetir el análisis usa `render`.

| Opción CLI | Nombre | Uso |
|---|---|---|
| `integration` | Integración por capas | Endpoint → destinos. Componentes amarillos, almacenes y flechas ortogonales; inspirada en creditos.xml. |
| `c4-container` | C4 de contenedores | Aplicaciones y almacenes observados; vista parcial, sin límites de sistema inventados. |
| `sequence` | Secuencia por endpoint | Orden, condiciones, paralelismo y fallos de cada petición. |
| `dependencies` | Mapa de dependencias | Resumen del servicio y recursos alcanzables. |

El adjunto creditos.xml se interpretó como un diagrama de integración con notación de componentes UML: `shape=module`, agrupaciones `umlFrame`, roles API/MS y conectores ortogonales. «Integración por capas» es el nombre de nuestra plantilla, no un estándar formal. Esta primera plantilla adapta las figuras, colores y orientación; no reproduce exactamente todas las agrupaciones del proyecto ni inventa roles UX/BS. Los datos del adjunto no se incorporan a otros servicios.

`TB` ordena de arriba abajo; `LR`, de izquierda a derecha. En integración las capas son servicio, endpoints y destinos; su posición no afirma que las dependencias se invoquen en ese orden. En C4 nativo la orientación dirige la disposición del grafo; el Mermaid equivalente puede distribuirlo de otro modo. La secuencia siempre conserva tiempo hacia abajo y participantes en horizontal.

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
- `views/c4-container.mmd` y `.drawio`: contenedores C4 en Mermaid y figuras nativas.
- `views/dependencies.mmd` y `.drawio`: mapa de dependencias con orientación elegida.
- `flows/*.sequence.mmd`: detalle por endpoint; `views/sequences.drawio` reúne sus páginas nativas, con bloques y ramas.
- `diagrams.drawio`: todas las vistas seleccionadas en un solo archivo multipágina.

Todos los tipos se generan localmente sin MCP. Puedes abrir el archivo en Draw.io original, Desktop o local. `--delivery files|local|mcp` elige cómo entregarlo; consulta [guía de entrega](entrega.md).

`publish` usa solo la selección vigente. `--all-diagrams` añade las secuencias. Los archivos de vistas anteriores pueden permanecer en disco, pero ya no forman parte de la selección. El informe base y sus secuencias siguen disponibles para consulta. Los hashes de las nuevas vistas y de la selección se comprueban antes de publicar. Cambiar de vista requiere fuentes originales sin modificaciones y una auditoría completa validada.

Para publicar las nuevas vistas nativas mediante MCP usa el servidor STDIO incluido. Un servidor HTTP que exponga únicamente `create_diagram` no admite publicación XML; el cliente informa la incompatibilidad antes de publicar el lote. Las secuencias seleccionadas se publican como un archivo multipágina; `--all-diagrams` no las duplica.

## Alcance C4

C4 tiene varios niveles. Esta versión implementa únicamente una vista parcial de contenedores: un endpoint es una operación, no un contenedor. Un repositorio aislado no permite deducir fronteras empresariales, propietarios, usuarios externos o todos los componentes internos. No se añaden personas ni límites de sistema sin esa información. Contexto C4 y componentes C4 quedan pendientes de un modelo de alcance más amplio.

Referencias: [definición oficial de contenedores](https://c4model.com/diagrams/container), [niveles de C4](https://c4model.com/diagrams), [sintaxis C4 de Mermaid](https://mermaid.js.org/syntax/c4.html). La sintaxis C4 de Mermaid es experimental; el proyecto valida con su versión fijada, y la compatibilidad de representación depende también del Mermaid incluido en Draw.io.
