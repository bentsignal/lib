import ExpoModulesCore
import Foundation

@_silgen_name("mobile_convex_engine_open")
private func mobileConvexEngineOpen(_ path: UnsafePointer<CChar>) -> OpaquePointer?

@_silgen_name("mobile_convex_engine_is_fresh")
private func mobileConvexEngineIsFresh(_ engine: OpaquePointer) -> Bool

@_silgen_name("mobile_convex_engine_transaction_succeeded")
private func mobileConvexEngineTransactionSucceeded(_ engine: OpaquePointer) -> Bool

@_silgen_name("mobile_convex_engine_close")
private func mobileConvexEngineClose(_ engine: OpaquePointer)

@_silgen_name("mobile_convex_engine_revision")
private func mobileConvexEngineRevision() -> UnsafePointer<CChar>

public final class MobileConvexModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MobileConvex")

    AsyncFunction("probeAsync") { (databaseLocation: String) in
      let databasePath = URL(string: databaseLocation)?.path ?? databaseLocation
      let engine = databasePath.withCString { mobileConvexEngineOpen($0) }
      guard let engine else {
        throw MobileConvexOpenException()
      }
      defer { mobileConvexEngineClose(engine) }

      return [
        "backend": "convex-rust-sqlite",
        "fresh": mobileConvexEngineIsFresh(engine),
        "revision": String(cString: mobileConvexEngineRevision()),
        "transactionSucceeded": mobileConvexEngineTransactionSucceeded(engine),
      ] as [String: Any]
    }
  }
}

private final class MobileConvexOpenException: Exception, @unchecked Sendable {
  override var reason: String {
    "The embedded Convex engine could not open its SQLite database."
  }
}
