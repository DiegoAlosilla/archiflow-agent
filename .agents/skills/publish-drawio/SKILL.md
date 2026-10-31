---
name: publish-drawio
description: Publica Mermaid o XML validados mediante el MCP oficial de Draw.io, con handshake, herramientas descubiertas y registro verificable del resultado.
---

# Publicar con Draw.io MCP

MCP es una entrega opcional: aplica esta conexión únicamente si el usuario eligió MCP o pidió publicación por ese canal. Para archivos o editor local usa `--delivery files|local`, sin handshake MCP. Consulta `docs/entrega.md`.

Cuando se elige MCP, primero `node src/cli.js mcp-check --out runs/mcp-check.json`. La conexión predeterminada usa el servidor oficial instalado y fijado en package-lock.json, por STDIO. `--mcp <config.json>` permite otro STDIO o Streamable HTTP.

Después `node src/cli.js publish --run <directorio>` o `node src/cli.js diagram --mermaid <archivo> --out <directorio> --publish`. El cliente pide la referencia, descubre herramientas y valida argumentos contra su esquema antes de llamar. No sustituyas una llamada MCP por un enlace construido manualmente.

Con `presentation.json`, publica las vistas elegidas por el usuario. Las cuatro vistas se publican como XML mediante `open_drawio_xml` para conservar figuras editables; requiere el MCP STDIO oficial o uno compatible. Las secuencias se agrupan en un archivo multipágina. Si el servidor solo admite Mermaid, informa la incompatibilidad antes de proponer otra entrega; no cambies silenciosamente de plantilla. `--publish` sigue siendo alias de `--delivery mcp`.

Conserva Mermaid y el registro de publicación incluso si falla. El resultado puede ser URL, vista o archivo: registra lo que ocurrió. Una URL no prueba inspección visual ni guardado en Draw.io. No publiques un resultado de auditoría con fallos de evidencia/cobertura.

Publicar contenido por Streamable HTTP lo envía al servidor configurado. STDIO local y el modelo de IA son procesos distintos; no prometas aislamiento total. No copies secretos al diagrama ni a sus registros.
