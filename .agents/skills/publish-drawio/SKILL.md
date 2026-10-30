---
name: publish-drawio
description: Publica Mermaid o XML validados mediante el MCP oficial de Draw.io, con handshake, herramientas descubiertas y registro verificable del resultado.
---

# Publicar con Draw.io MCP

Primero `node src/cli.js mcp-check --out runs/mcp-check.json`. La conexión predeterminada usa el servidor oficial instalado y fijado en package-lock.json, por STDIO. `--mcp <config.json>` permite otro STDIO o Streamable HTTP.

Después `node src/cli.js publish --run <directorio>` o `node src/cli.js diagram --mermaid <archivo> --out <directorio> --publish`. El cliente pide la referencia, descubre herramientas y valida argumentos contra su esquema antes de llamar. No sustituyas una llamada MCP por un enlace construido manualmente.

Con `presentation.json`, publica las vistas elegidas por el usuario. Integración se publica como XML mediante `open_drawio_xml` para conservar componentes y conexiones ortogonales; requiere el MCP STDIO oficial o uno compatible con esa herramienta. El resto usa Mermaid. Si el servidor solo admite Mermaid, informa la limitación de estilo antes de proponer el archivo alternativo `views/integration.mmd`. No cambies silenciosamente de plantilla. Varias secuencias pueden abrir varias pestañas.

Conserva Mermaid y el registro de publicación incluso si falla. El resultado puede ser URL, vista o archivo: registra lo que ocurrió. Una URL no prueba inspección visual ni guardado en Draw.io. No publiques un resultado de auditoría con fallos de evidencia/cobertura.

Publicar contenido por Streamable HTTP lo envía al servidor configurado. STDIO local y el modelo de IA son procesos distintos; no prometas aislamiento total. No copies secretos al diagrama ni a sus registros.
