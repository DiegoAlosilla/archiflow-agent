---
name: archiflow-scan
description: Analiza código de un microservicio o endpoint para documentar flujos hacia APIs, Redis, bases de datos y eventos, con evidencia y cobertura explícitas. Genera Mermaid estándar y diagramas mediante el MCP de Draw.io. Úsala para ingeniería inversa desde repositorios, no para inventariar un diagrama existente.
---

# ArchiFlow Scan

Transforma código accesible en documentación trazable y Mermaid estándar. No introduzcas un DSL de arquitectura ni una dependencia del editor ArquiFlow. Esta skill dirige al agente: no es un analizador universal compilado ni un comando de terminal.

## Entrada y alcance

Acepta instrucciones como:

```text
$archiflow-scan analiza D:\repos\orders el endpoint GET /orders/{id}; genera documentación y Draw.io mediante MCP.
$archiflow-scan analiza todos los endpoints de D:\repos\orders y sus consumidores de eventos; genera Mermaid y Draw.io mediante MCP.
```

Usa el repositorio actual si está identificado. Si falta código accesible, pide su ubicación; no inventes resultados. Por defecto recorre todos los endpoints del servicio seleccionado y registra consumidores/jobs como entradas separadas. En monorepos identifica la aplicación pedida; pregunta solo si el contexto no permite elegir.

Lee las instrucciones del repositorio. Registra raíz, revisión Git, modificaciones relevantes y perfiles examinados. No ejecutes el servicio ni peticiones mutadoras contra infraestructura para descubrir flujos. Las trazas existentes pueden complementar el análisis cuando están disponibles y autorizadas.

## Objetivos y cobertura

Mantén `progress.md` con objetivos de inventario, trazado, documentación, diagramación y validación. Antes de recorrer la lógica, crea una fila por entrada descubierta. Usa estados `pendiente`, `en análisis`, `analizado` y `bloqueado`, con motivo y siguiente paso para reanudar.

Completa las entradas accesibles sin detenerte tras el primer endpoint. Si una está bloqueada, continúa con las otras. Finaliza cuando cada entrada tenga resultado y se hayan realizado las validaciones aplicables; declara cobertura parcial si corresponde. La cobertura del inventario descubierto no garantiza encontrar rutas registradas dinámicamente.

## Descubrir y seguir el flujo

1. Identifica lenguaje/framework, rutas, contratos, inyección, configuración y clientes. Localiza candidatos con búsquedas y después lee definiciones y llamadas: imports y paquetes instalados no prueban ejecución.
2. Sigue entrada → middleware/filtros relevantes → handler → lógica → adaptadores. Resuelve interfaces, implementaciones y módulos compartidos accesibles según el perfil disponible.
3. Extrae saltos alcanzables: HTTP/gRPC, operaciones Redis, consultas/mutaciones de base de datos y publicación/consumo de eventos. Conserva operaciones independientes aunque compartan destino. Distingue caché, bloqueo y stream si es verificable.
4. Conserva orden, condiciones, retornos tempranos, bucles, concurrencia, errores, timeouts, retry, fallback y transacciones cuando sean visibles. Sigue anotaciones, interceptores y configuración que alteren llamadas.
5. Distingue construir una operación de ejecutarla: pipelines lazy/reactivos, suscripciones, callbacks y publicación diferida pueden cambiar el orden. Documenta el límite cuando no pueda resolverse.
6. Extrae método/path destino, entidad/tabla, patrón de clave/TTL y tópico/contrato de evento solo si hay evidencia. Conserva variables de configuración no resueltas; no fabriques hosts, claves ni nombres de servicio.
7. Detente en la frontera del código accesible. Publicar un evento no prueba quién lo consume ni que haya terminado; un cliente HTTP no revela la lógica interna remota.

Si solo hay OpenAPI, documenta contrato y límite, sin inventar implementación. Contrasta rutas implementadas y contrato cuando ambos existan.

## Evidencia

Cada afirmación arquitectónica enlaza archivo, líneas y símbolo, o una fuente externa identificada. Usa:

- `observado en código`: operación/condición explícita; no prueba ejecución en producción.
- `observado en ejecución`: traza identificable con entorno/fecha; no prueba todos los caminos.
- `inferido`: interpretación con fundamento explicado.
- `no resuelto`: faltan configuración, código o datos de despacho/entorno.

No deduzcas conexiones por nombres o bibliotecas instaladas. Conserva discrepancias entre contrato, código y trazas. Para «qué no hace», escribe «no se encontró evidencia en el alcance revisado», salvo un límite explícito documentado. Ausencia de hallazgos no prueba ausencia universal.

## Entregables y diagramas

Lee [references/deliverables.md](references/deliverables.md) antes de generar resultados. Guarda por defecto en `docs/archiflow-scan/<servicio>/` del repositorio analizado, respetando una ubicación pedida. Conserva ajustes manuales: si el origen de un archivo es ambiguo, crea una revisión nueva.

Genera un mapa general `flowchart` y un `sequenceDiagram` por entrada. Añade flowcharts de condiciones cuando aporten claridad y divide escenarios grandes en vistas enlazadas. Conserva identidades de flujo entre inventario, documentación y diagramas. Modela componentes y saltos arquitectónicos; deja métodos internos en la evidencia salvo que expliquen una condición.

Mermaid es el texto revisable del diagrama; Markdown/CSV guardan evidencia y cobertura. No recargues las etiquetas con toda la documentación.

## Draw.io MCP

Lee [references/drawio-mcp.md](references/drawio-mcp.md) al preparar esta fase. Descubre herramientas y esquemas reales; guarda Mermaid antes de invocarlas. Usa Mermaid por defecto y XML nativo si hacen falta páginas, metadatos o estilos no conservados por la conversión.

Si falta el MCP, completa documentación y Mermaid y deja publicación pendiente. No lo sustituyas silenciosamente por un enlace manual ni afirmes que se abrió o guardó un diagrama. Si solo se pidió análisis, no publiques.

## Validación y cierre

- Reconcilia entradas descubiertas = analizadas + bloqueadas + excluidas explícitamente. No declares barrido completo con pendientes; explica filtros y registro dinámico no soportado.
- Cada salto dibujado tiene evidencia. Cada dependencia alcanzable identificada está dibujada o tiene exclusión justificada.
- Contrasta condiciones, orden, retornos y fallos con código. No declares exhaustivas combinaciones no exploradas.
- Valida Mermaid con parser/renderizador disponible; si falta, declara sintaxis/renderizado sin verificar. No instales dependencias sin necesidad de la tarea.
- Inspecciona el resultado del MCP y el renderizado si es accesible: ramas, etiquetas, dirección y legibilidad. Sintaxis válida no prueba semántica correcta.
- Informa por separado análisis, Mermaid, renderizado y publicación MCP; entrega rutas reales, cobertura y límites. Validar esta skill no equivale a probar el flujo integral.
