# Conexión MCP de Draw.io

## Predeterminada: STDIO local

Después de `npm ci --ignore-scripts`, ejecuta desde la raíz:

```powershell
node src/cli.js mcp-check --out runs/mcp-check.json
node src/cli.js publish --run runs/rest-fights
```

El cliente usa `process.execPath` y la ruta absoluta del paquete local `@drawio/mcp`. No usa un `npx` sin versión ni modifica la configuración global del equipo. Se conecta mediante el SDK oficial de MCP, realiza initialize/listTools, obtiene `get_drawio_reference` y llama a `open_drawio_mermaid` o `open_drawio_xml`, según la vista seleccionada, con los argumentos validados. Integración por capas usa XML nativo multipágina y requiere soporte de esa herramienta; consulta [tipos de diagrama](diagramas.md).

El servidor puede abrir el navegador predeterminado. Un éxito MCP significa que la herramienta aceptó el contenido y devolvió un resultado; no demuestra que el navegador lo haya renderizado correctamente. El registro conserva `visualInspection: not-performed` y `drawioFileSaved: false`. El `.drawio` generado por el arnés es un archivo local distinto de ese resultado MCP.

## Configuración explícita

```powershell
node src/cli.js mcp-check --mcp config/mcp.stdio.example.json
node src/cli.js publish --run runs/rest-fights --mcp config/mcp.stdio.example.json
```

En `transport: stdio`, configura `command`, `args`, `cwd` si corresponde, `env` y `timeoutMs`. La configuración es de confianza: `command` inicia un proceso local. No la tomes de un repositorio auditado. Las rutas relativas se interpretan con el directorio de trabajo configurado, o la raíz de ArchiFlow por defecto.

`env.DRAWIO_BASE_URL` permite una instancia autogestionada compatible. Que un editor tenga el mismo nombre no demuestra compatibilidad; hay que probar su importación. El servidor alojado y el motor de IA son fronteras independientes.

## Streamable HTTP

`config/mcp.http.example.json` configura el servidor alojado comprobado con `create_diagram` y su campo `mermaid`. Revisa `mcp-check` y el esquema del servidor antes de ajustar `mermaidTool`, `contentField` y `arguments`; la compatibilidad depende de la versión. La publicación valida esos argumentos contra el esquema descubierto y falla si son incompatibles.

```powershell
node src/cli.js mcp-check --mcp config/mcp.http.example.json
```

Para un servidor corporativo que acepte bearer token, usa `bearerTokenEnv` con el nombre de una variable de entorno; nunca guardes el token en el JSON. El cliente acepta HTTPS y HTTP solo para loopback. No implementa login OAuth interactivo: usa STDIO o una conexión HTTP con autenticación preconfigurada.

## Usar las herramientas desde Codex

La configuración local está en `.codex/config.toml`. Abre Codex desde la raíz y confía en el proyecto cuando el cliente lo solicite. `/mcp` o `codex mcp list` permiten inspeccionar la configuración del cliente; `mcp-check` demuestra conectividad real desde el arnés. Si la sesión ya estaba iniciada antes de crear la configuración, puede necesitar reiniciarse para cargar herramientas nuevas.

No es necesario ejecutar `codex mcp add` globalmente para que este proyecto funcione.

## Diagnóstico

| Error | Acción |
|---|---|
| No encuentra módulo MCP | Ejecuta `npm ci --ignore-scripts` desde la raíz |
| Timeout/servidor caído | Revisa comando/URL y timeout; la documentación y Mermaid se conservan |
| Herramienta o argumento incompatible | Inspecciona esquema real y ajusta la configuración explícita |
| Auditoría parcial | Revisa `progress.md`, corrige acceso/fuentes y reanuda antes de publicar |
| URL devuelta pero no hay dibujo | Abre el enlace y revisa conversión/renderizado en esa versión de Draw.io |

Fuentes: [servidor oficial](https://github.com/jgraph/drawio-mcp), [Tool Server](https://github.com/jgraph/drawio-mcp/blob/main/mcp-tool-server/README.md), [MCP en Codex](https://developers.openai.com/codex/mcp/). Consultadas el 29 de octubre de 2026.
