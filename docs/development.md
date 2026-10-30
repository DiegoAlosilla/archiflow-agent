# Extender ArchiFlow Agent

## Estructura

```text
agent/system.md               Identidad y reglas del agente
.agents/skills/               Skills propias del proyecto
.codex/config.toml            MCP local para Codex interactivo
src/discovery.js              Inventario y fuentes reproducibles
src/engine.js                 Adaptador al motor Codex
src/runner.js                 Objetivos, reanudación y ejecución
src/schema.js                 Contrato estructurado de hallazgos
src/validation.js             Invariantes de evidencia y cobertura
src/mermaid.js                Validación con Mermaid
src/render.js                 Documentación, mapas y Draw.io nativo
src/presentation.js           Catálogo, selección y vistas de integración/C4
src/mcp.js                    SDK cliente STDIO/Streamable HTTP
src/cli.js                    Comandos del desarrollador
test/                        Pruebas del arnés
```

Para añadir Spring, Node o .NET, implementa descubrimiento explícito de sus entradas y conserva el contrato del inventario. No cambies etiquetas para aparentar soporte de un framework no probado. Añade fixtures con rutas, clientes salientes y casos ambiguos antes de declararlo soportado.

El adaptador Codex puede sustituirse por otro motor que reciba inventario, entradas y fuentes y devuelva el mismo contrato. No envíes resultados del modelo directamente al MCP: deben pasar por `validateFlow` y `validateAudit`.

Las skills locales definen decisiones de auditoría, legibilidad y publicación. Modificarlas cambia la huella del arnés y obliga a una ejecución nueva. Pueden usarse como base de otro agente; no heredan las skills históricas de usuario.

Ejecuta `npm test` para cambios de lógica. Usa `npm run mcp:check` para verificar el servidor oficial. Un futuro adaptador de animación debe reproducir escenarios respaldados por evidencia y no inferir orden a partir de la posición de cajas.

Referencias: [ejecución estructurada con Codex](https://developers.openai.com/codex/noninteractive/), [skills locales](https://developers.openai.com/codex/skills/), [Mermaid](https://mermaid.js.org/syntax/sequenceDiagram.html).
