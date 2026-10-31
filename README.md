# ArchiFlow Agent

Agente de auditoría para que un desarrollador pueda explicar qué hace un microservicio y qué ocurre detrás de cada entrada: APIs, Redis, almacenamiento, eventos, condiciones y fallos. Este es un proyecto independiente con sus propias skills y arnés; las skills históricas no son dependencias.

**Dos recorridos:** código → documentación, Mermaid y archivos `.drawio`; Mermaid existente → validación y `.drawio`. Los archivos se abren en Draw.io original, Desktop o local. La apertura automática en el editor local y la conexión MCP son opciones de entrega. La primera versión de descubrimiento está orientada a Java/Quarkus y Jakarta REST/OpenAPI.

## Instalación

Requisitos: Node.js 22 o posterior, Git y Codex CLI con una sesión válida para el análisis por IA. Java, Maven, Docker y una base de datos no son necesarios: el agente no ejecuta el microservicio.

Desde la raíz del proyecto, en PowerShell, Linux o macOS:

```powershell
git clone https://github.com/DiegoAlosilla/archiflow-agent.git
cd archiflow-agent
npm ci --ignore-scripts
codex login
node src/cli.js doctor
npm test
```

Si ya tienes sesión de Codex, no necesitas iniciar sesión de nuevo. Si no tienes su CLI, consulta la [instalación oficial](https://developers.openai.com/codex/cli/). `doctor` comprueba Node y Codex; añade `--check-mcp` para comprobar también MCP. Un error de autenticación impide el análisis, pero no convertir un Mermaid existente.

Las dependencias están fijadas en `package-lock.json`. El MCP oficial se instala localmente. `--ignore-scripts` omite los scripts de instalación de dependencias; las herramientas STDIO utilizadas aquí no necesitan precalentar sus renderizadores opcionales. No se modifica configuración ni skills globales.

El repositorio incluye código, skills, configuración de ejemplo y pruebas. Las auditorías de `runs/`, credenciales, configuraciones `config/*.local.json` y el checkout descargado de Quarkus quedan fuera de Git. El XML empresarial usado como referencia visual no se distribuye. Las pruebas automáticas de GitHub no requieren una cuenta de Codex: usan un motor simulado y un servidor MCP local de prueba; el análisis real requiere tu sesión.

## Probar con un microservicio público

```powershell
npm run example:fetch
npm run example:audit
```

Se descarga [Quarkus Super Heroes](https://github.com/quarkusio/quarkus-super-heroes) en la revisión indicada en `examples/source.json`, manteniendo su licencia Apache-2.0. El alcance inicial es `rest-fights`; los servicios vecinos se descargan como referencia. El análisis predeterminado se limita al directorio del servicio, sin afirmar haber auditado internamente sus vecinos.

El contexto predeterminado `core` incluye código, configuración y contratos de `src/main`, más el descriptor de build. Evita enviar repetidamente todas las variantes generadas de despliegue. El proceso consume el uso de la cuenta conectada a Codex; analiza lotes de tres entradas y guarda cada resultado validado para reanudar.

```powershell
node src/cli.js validate --run runs/rest-fights
node src/cli.js publish --run runs/rest-fights
```

La publicación abre las vistas elegidas en Draw.io a través del MCP oficial. Las auditorías antiguas sin selección conservan el mapa general. Las secuencias de todos los endpoints quedan guardadas; `--all-diagrams` publica también cada una y puede abrir varias pestañas.

## Elegir la presentación

El agente pregunta qué diagramas quieres cuando no has indicado una preferencia. La terminal interactiva también muestra el menú. Puedes elegir uno o varios:

| Tipo | Opción |
|---|---|
| Integración por capas, inspirada en el ejemplo creditos.xml | `integration` |
| C4 de contenedores, vista parcial del alcance observado | `c4-container` |
| Secuencia por endpoint | `sequence` |
| Mapa resumido de dependencias | `dependencies` |

En herramientas de chat o automatización pasa la elección explícita. `TB` indica arriba abajo y `LR`, izquierda derecha. Las secuencias mantienen su convención temporal.

```powershell
node src/cli.js audit --repo "D:\repos\mi-servicio" --out runs/mi-servicio --diagram-type integration,sequence --direction TB
node src/cli.js render --run runs/rest-fights --diagram-type c4-container --direction LR --publish
```

`render` usa la auditoría ya validada sin repetir el análisis por IA. Consulta [tipos, plantillas y alcance C4](docs/diagramas.md).

## Elegir la entrega

El agente ofrece **archivos**, **editor local** o **MCP**. Sin elección en automatización usa archivos; la terminal interactiva pregunta. `--publish` se conserva como alias de `--delivery mcp`.

```powershell
# Paquete multipágina para abrir en cualquier Draw.io compatible
node src/cli.js render --run runs/rest-fights --diagram-type integration,c4-container,sequence,dependencies --delivery files

# Abrir en el editor local ya iniciado
node src/cli.js render --run runs/rest-fights --diagram-type integration,sequence --delivery local --editor-url http://127.0.0.1:8080/

# MCP opcional
node src/cli.js render --run runs/rest-fights --diagram-type c4-container --delivery mcp
```

Abre `runs/rest-fights/diagrams.drawio` desde **Archivo → Abrir desde → Dispositivo** en la web original, o en tu editor local. El modo local comprueba disponibilidad y confirma la carga mediante un puente efímero; no requiere cambios en el fork. La [guía de entrega](docs/entrega.md) explica arranque, guardado, conexión y capacidades de conversión.

## Auditar tu servicio

```powershell
node src/cli.js audit --repo "D:\repos\mi-servicio" --out "D:\auditorias\mi-servicio"
node src/cli.js audit --repo "D:\repos\mi-servicio" --out "D:\auditorias\un-endpoint" --endpoint "GET /api/orders/{id}"
```

Sin `--endpoint`, se recorren todas las entradas descubiertas. `--publish` añade publicación de las vistas elegidas al terminar si todas las entradas seleccionadas pasaron validación. Usa el mismo método/path exacto del inventario; no una URL con un ID concreto.

```powershell
node src/cli.js discover --repo "D:\repos\mi-servicio" --out runs/inventory.json
node src/cli.js audit --repo "D:\repos\mi-servicio" --out runs/mi-servicio --resume
```

La salida debe quedar separada del repositorio objetivo. Una ejecución existente requiere `--resume`; cambios en fuentes, alcance o instrucciones requieren un directorio nuevo. Un endpoint bloqueado o una validación fallida deja estado parcial y código de salida 2. Los errores de comando usan código 1; un resultado completo usa 0.

Opciones: `--batch-size 1..10` (predeterminado 3), `--timeout-seconds 10..3600` (600 por lote), `--max-context` (430 000 caracteres por defecto). El arnés falla antes de enviar fuentes si el límite no alcanza, sin truncarlas silenciosamente.

`--context-scope core` es el valor predeterminado. Usa `--context-scope all --max-context 1000000` para incluir también los manifiestos y variantes de despliegue del ejemplo. La selección se registra en el inventario y los eventos; las conclusiones sobre infraestructura dependen de las fuentes incluidas. Puedes ampliar este contexto al reanudar conservando los resultados ya validados del mismo snapshot.

## Recibir Mermaid como entrada

```powershell
node src/cli.js diagram --mermaid examples/cache-aside.mmd --out runs/mermaid-demo
node src/cli.js diagram --mermaid examples/cache-aside.mmd --out runs/mermaid-publicado --publish
```

Se validan `flowchart`, `sequenceDiagram` y `C4Container`, sin directivas de configuración ni enlaces ejecutables. Se generan `diagram.mmd` y `diagram.drawio`; la conversión nativa admite el [subconjunto documentado](docs/entrega.md#mermaid-como-entrada) y rechaza construcciones no soportadas sin borrar su semántica. Este recorrido registra origen; no afirma que el diagrama corresponda a un repositorio auditado.

## Entregables

| Archivo | Contenido |
|---|---|
| `report.md` | Resumen, cobertura e índice de entradas |
| `flows/*.md` | Propósito, saltos, condiciones, errores, límites y evidencia por entrada |
| `architecture.mmd` | Mapa Mermaid de dependencias alcanzables |
| `flows/*.sequence.mmd` | Secuencia Mermaid por entrada |
| `architecture.drawio` | Mapa nativo editable, generado localmente |
| `diagrams.drawio` | Paquete multipágina con todas las vistas seleccionadas, listo para abrir sin MCP |
| `delivery.json` | Entrega por archivos o confirmación de carga en el editor local |
| `presentation.json`, `views/*` | Selección de vistas, orientación y diagramas generados con esa elección |
| `coverage.csv`, `evidence.csv` | Inventarios filtrables y citas |
| `inventory.json` | Archivos, hashes, entradas, revisión y límites del descubrimiento |
| `audit.json`, `results/*.json` | Hallazgos estructurados validados |
| `state.json`, `progress.md`, `events.jsonl` | Objetivos, reanudación y eventos del arnés |
| `publication.json` | Llamadas MCP y respuestas reales, separadas de inspección visual |

El JSON interno permite comprobar hallazgos mecánicamente. El desarrollador escribe instrucciones o Mermaid estándar; no necesita aprender un lenguaje de arquitectura nuevo.

## Skills propias

Están en `.agents/skills/` y son locales al proyecto. El ejecutor incorpora sus instrucciones al prompt de análisis, por lo que el funcionamiento no depende de instalarlas globalmente:

- `$audit-microservice`: descubrir y auditar entradas con evidencia.
- `$explain-mermaid`: expresar recorridos legibles y validar Mermaid recibido.
- `$publish-drawio`: comprobar conexión y publicar mediante MCP.

En una sesión interactiva de Codex abierta en esta carpeta puedes pedir: «Usa $audit-microservice para analizar D:\repos\mi-servicio y publicar el mapa con $publish-drawio». El CLI es la ruta reproducible que aplica las mismas comprobaciones.

## Conectar el MCP

```powershell
node src/cli.js mcp-check --out runs/mcp-check.json
```

El cliente propio inicia el servidor local fijado, negocia MCP, descubre herramientas, consulta su referencia y valida argumentos contra el esquema anunciado. No genera una URL a mano para simular conexión. La configuración `.codex/config.toml` incluye el mismo servidor deshabilitado por defecto (`enabled = false`); actívalo si quieres usar sus herramientas directamente en una sesión de Codex que confíe en este proyecto. El CLI con `--delivery mcp` administra su conexión por separado.

Consulta [conexión y configuración MCP](docs/mcp.md), [arquitectura y controles](docs/harness.md) y [extender el agente](docs/development.md).

La [verificación de la primera versión](docs/verification.md) registra las pruebas realizadas y el resultado del ejemplo público.

## Límites de esta versión

El inventario inicial usa CST de Java y OpenAPI local. Rutas dinámicas o definidas por constantes, herencia compleja, otros frameworks y dispatch en runtime requieren ampliar descubrimiento o revisión manual. Las rutas no resueltas y los errores de parseo se muestran; no se inventan paths. El LLM interpreta caminos, y el arnés comprueba estructura, citas, destinos, cobertura y sintaxis; no demuestra que una interpretación semántica sea correcta ni equivale a una prueba en producción.

El código se envía al motor de Codex configurado. El objetivo se trata como datos y no se ejecuta. Un MCP local no convierte al modelo en local. No se debe concluir «no usa RDS» por no encontrarlo: se documenta lo observado y el alcance revisado.
