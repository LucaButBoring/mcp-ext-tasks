# MCP Tasks Extension (Experimental)

> **⚠️ Experimental Extension** — This repository contains an **experimental** extension to the [Model Context Protocol](https://modelcontextprotocol.io). It is **not** an official extension and may change significantly or be discontinued. See the [Extensions specification](https://modelcontextprotocol.io/seps/2133-extensions) for details on the experimental extension process.

## Overview

This extension defines the **Tasks** primitive for the Model Context Protocol (MCP). Tasks are durable state machines that carry information about the underlying execution state of a request, enabling requestor polling and deferred result retrieval. Each task is uniquely identifiable by a receiver-generated **task ID**.

Tasks are useful for:

- Representing expensive computations and batch processing requests
- Integrating seamlessly with external job/workflow APIs
- Enabling call-now, fetch-later execution patterns

**Extension Identifier:** `io.modelcontextprotocol/tasks`

## Specification

The full specification for Tasks as defined in the `2025-11-25` MCP protocol version can be found at:

- **Specification:** [`docs/specification/2025-11-25/tasks.mdx`](docs/specification/2025-11-25/tasks.mdx)
- **Schema (TypeScript):** [`schema/2025-11-25/schema.ts`](schema/2025-11-25/schema.ts)
- **Schema (JSON):** [`schema/2025-11-25/schema.json`](schema/2025-11-25/schema.json)

## Development

### Schema Generation

The JSON Schema is auto-generated from the TypeScript type definitions using [ts-to-zod](https://github.com/fabien0102/ts-to-zod) and Zod's `toJSONSchema()`. Do not hand-edit `schema.json` or `generated/schema.ts`.

```bash
# Generate Zod schemas and JSON Schema from schema.ts
npm run generate:schemas

# Verify TypeScript compiles and generated files are up to date
npm run check:schema
```

## SEPs

- [SEP-1686: Tasks](seps/1686-tasks.md) — The original proposal that introduced Tasks to the MCP specification.

## Status

This extension was originally part of the core MCP specification in the `2025-11-25` release. It is being extracted into an experimental extension to allow the feature to incubate and evolve independently, with the intention of eventually promoting it back into the core protocol once it has stabilized.

The Tasks extension is maintained by the **Agents Working Group**.

## Governance

This repository follows the [Model Context Protocol Governance](https://modelcontextprotocol.io/community/governance) process. See [MAINTAINERS.md](MAINTAINERS.md) for the list of maintainers specific to this repository.

## Policies

This repository follows the Model Context Protocol project policies:

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
