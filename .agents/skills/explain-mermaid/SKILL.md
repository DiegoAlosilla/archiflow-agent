---
name: explain-mermaid
description: Convierte hallazgos auditados en secuencias Mermaid entendibles por endpoint y un mapa de dependencias, preservando condiciones y evidencia. También valida Mermaid recibido como entrada.
---

# Explicar recorridos con Mermaid

Genera `sequenceDiagram` por entrada con `autonumber`, alias simples, mensajes arquitectónicos y alternativas respaldadas. Cada paso documentado incluye `%% step:<id>` y se relaciona con un destino auditado. Los métodos auxiliares se conservan en evidencia salvo que expliquen una condición.

El arnés conserva el mapa base y las secuencias como documentación, y ofrece vistas seleccionables: `dependencies` (mapa resumido), `integration` (componentes y endpoints por capas, inspirada en creditos.xml), `c4-container` (C4 parcial de contenedores observados), `sequence` (secuencia por endpoint). `--direction TB|LR` define la orientación de arquitectura; la secuencia mantiene su eje temporal vertical. No dibujes dependencias por estar instaladas: usa únicamente pasos auditados. No atribuyas roles UX/BS ni límites de sistema sin evidencia.

Antes de generar vistas en chat, si falta la elección, ofrece esas cuatro opciones, permite combinarlas y pregunta orientación. Si piden «C4» sin nivel, explica que esta versión soporta contenedores; contexto y componentes requieren más información y no son opciones implementadas. Si piden «como creditos.xml», selecciona `integration`. La plantilla reutiliza estilo y figuras, nunca los nombres, endpoints ni conexiones del ejemplo.

Para cambiar la presentación de hallazgos existentes usa `node src/cli.js render --run <auditoría> --diagram-type integration,sequence --direction TB`. Este comando valida evidencia y genera `presentation.json` y `views/` sin invocar al modelo. C4 no convierte endpoints en contenedores; deja los límites del sistema sin determinar cuando faltan datos. La integración muestra alcanzabilidad; no representa orden temporal. Las secuencias conservan ramas y fallos. Consulta `docs/diagramas.md` para el catálogo y ejemplos.

Para Mermaid ya escrito ejecuta `node src/cli.js diagram --mermaid <archivo.mmd> --out <directorio>`. La validación sintáctica no confirma la arquitectura; documenta que proviene del usuario y no fue auditado contra código.

No elimines errores o ramas para mejorar el dibujo. Divide escenarios grandes y enlaza sus documentos. Usa el vocabulario del desarrollador y conserva rutas exactas del contrato.
