# Integración Draw.io por MCP

## Ejecución

Descubre herramientas y esquemas disponibles: servidores oficiales y comunitarios pueden diferir. Si existe `get_drawio_reference`, consulta el formato antes del primer diagrama. El Tool Server oficial ofrece `open_drawio_mermaid` y `open_drawio_xml` con `content`; el App Server ofrece `create_diagram`. Confirma siempre el esquema de la sesión. [Documentación oficial del Tool Server](https://github.com/jgraph/drawio-mcp/blob/main/mcp-tool-server/README.md).

Guarda primero el Mermaid. Publica mapa general y vistas solicitadas por entrada; para muchos endpoints usa índice y páginas si hay soporte, evitando abrir decenas de pestañas sin necesidad. Usa XML nativo para páginas/metadatos/estilos no conservados por conversión; conserva el Mermaid original y no prometas conversión reversible.

Registra herramienta, formato, flow-id/vista, resultado, URL/archivo y estado de inspección en `publication.md`. Si solo devuelve una URL, dilo. Abrir el editor, guardar un archivo e inspeccionar el renderizado son estados distintos.

Ante fallo corregible de sintaxis/parámetros, usa el diagnóstico para un reintento acotado. Si persiste, conserva entregables locales y marca publicación pendiente. No cambies configuración MCP ni instales paquetes como efecto secundario de esta skill.

## Servidores y editor propio

El Tool Server oficial se ejecuta con `npx @drawio/mcp`; existen opciones alojadas y autogestionadas del App Server. Usa la conexión autorizada del proyecto. El alojado recibe contenido; un MCP local no implica que el modelo sea local ni garantiza ausencia de red para cargar recursos del editor. [Opciones y residencia de datos](https://github.com/jgraph/drawio-mcp#data-residency--offline-use).

El Tool Server documenta `DRAWIO_BASE_URL` para una instancia propia. Un fork del editor solo podría aprovecharlo si conserva compatibilidad de carga/importación; debe probarse. Una aplicación distinta necesita un adaptador, aunque también se llame Draw.io.

## Animación

Draw.io permite animación de conectores y acciones de presentación. Eso no descubre ni demuestra escenarios de ejecución. En v1 la aceptación depende de trazabilidad y vistas estáticas; la animación es opcional. No inventes tiempos o paralelismo para animar. [Animación de conectores](https://www.drawio.com/docs/manual/connectors/connector-animate/).

Fuentes comprobadas el 29 de octubre de 2026. Verifica cambios cuando la compatibilidad sea relevante. [Opciones MCP](https://www.drawio.com/docs/manual/generate/drawio-mcp-server/), [referencia Mermaid](https://github.com/jgraph/drawio-mcp/blob/main/shared/mermaid-reference.md).
