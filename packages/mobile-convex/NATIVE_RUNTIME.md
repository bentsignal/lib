# Native runtime spike

This track tests whether the open-source Convex backend can become an
in-process iOS library. It is intentionally separate from the working
TypeScript runtime until it can execute the same query and mutation modules.

The pinned backend is licensed under
[FSL-1.1-Apache-2.0](https://github.com/get-convex/convex-backend/blob/main/LICENSE.md).
This repository uses it as an internal research checkpoint. Redistributing a
mobile backend based on the upstream code needs license review or permission
from Convex before release, particularly because the license restricts
competing uses.

## Verified boundary

The spike pins Convex backend revision
`f6c5782907f1fde2bf4e28287b7357e34a51462c`.

- Convex's `sqlite` crate compiles unchanged for `aarch64-apple-ios-sim`.
- A Rust `staticlib` can own `SqlitePersistence` and expose it through a small C
  ABI.
- Expo autolinking discovers the Swift module in this package.
- A local EAS development-client build launches on iOS Simulator, initializes
  Convex's three persistence tables, and commits through Convex's `Persistence`
  transaction API in process.
- The upstream `isolate` crate does not compile unchanged for iOS. Its required
  dependency graph reaches search, vector search, and RocksDB; RocksDB's binding
  generator rejects the Simulator target triple before the function runner is
  compiled.
- `rusty_v8` does not publish an iOS archive. Its source supports an iOS
  JITless/lite-mode build, so a release pipeline must build and package that
  archive itself.

The current native API is only a persistence probe. It creates the same
`documents`, `indexes`, and `persistence_globals` tables as the self-hosted
backend and verifies an empty write transaction without changing user data. The
app still executes queries and mutations in the TypeScript runtime.

## Intended runtime boundary

The useful mobile backend is smaller than `local_backend`:

1. Keep Convex values, IDs, indexing, transactions, schema enforcement, and
   SQLite persistence.
2. Keep the query and mutation UDF path.
3. Feature-gate actions, HTTP actions, scheduling, auth providers, file storage,
   search, vector search, Postgres, and server transports.
4. Bundle function modules and the UDF snapshot with the app. Do not download
   executable function deployments at runtime.
5. Expose name-based query, mutation, and subscription calls over a C ABI to the
   Expo module.

That boundary can preserve one schema and one set of query/mutation source files
for local and cloud execution. The public JavaScript facade should accept normal
Convex `FunctionReference` objects so application call sites do not encode which
backend is active.

## Build checkpoint

Install the pinned Rust nightly and build the Simulator archive:

```sh
rustup toolchain install nightly-2026-06-28
rustup target add aarch64-apple-ios-sim --toolchain nightly-2026-06-28
rustup target add x86_64-apple-ios --toolchain nightly-2026-06-28
./native/scripts/build-ios-simulator.sh
```

The build currently produces a universal Simulator library. A device slice
needs to be packaged as an XCFramework before this can be a distributable Expo
package.

## Next extraction milestones

1. Fork the upstream workspace with mobile Cargo features that cut the
   server-only dependency edges.
2. Extract the Convex database layer and execute document/index transactions
   through the native API.
3. Build V8 in JITless mode and run a bundled Convex query module.
4. Add native subscriptions and a `FunctionReference`-compatible JavaScript
   client.
5. Run the same schema and function compatibility suite against local native and
   hosted Convex backends.
