use std::{
    ffi::{CStr, c_char},
    path::Path,
    ptr,
};

use convex_common::persistence::{ConflictStrategy, Persistence as _};
use convex_sqlite::SqlitePersistence;

const CONVEX_REVISION: &[u8] = b"f6c5782907f1fde2bf4e28287b7357e34a51462c\0";

pub struct MobileConvexEngine {
    _persistence: SqlitePersistence,
    fresh: bool,
    transaction_succeeded: bool,
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn mobile_convex_engine_open(path: *const c_char) -> *mut MobileConvexEngine {
    if path.is_null() {
        return ptr::null_mut();
    }

    // SAFETY: The caller guarantees that path is a valid C string for this call.
    let Ok(path) = unsafe { CStr::from_ptr(path) }.to_str() else {
        return ptr::null_mut();
    };
    let fresh = !Path::new(path).exists();
    let Ok(persistence) = SqlitePersistence::new(path) else {
        return ptr::null_mut();
    };
    let transaction_succeeded =
        futures::executor::block_on(persistence.write(&[], &[], ConflictStrategy::Error)).is_ok();

    Box::into_raw(Box::new(MobileConvexEngine {
        _persistence: persistence,
        fresh,
        transaction_succeeded,
    }))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn mobile_convex_engine_is_fresh(engine: *const MobileConvexEngine) -> bool {
    if engine.is_null() {
        return false;
    }

    // SAFETY: A non-null engine must have been returned by mobile_convex_engine_open.
    unsafe { (*engine).fresh }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn mobile_convex_engine_transaction_succeeded(
    engine: *const MobileConvexEngine,
) -> bool {
    if engine.is_null() {
        return false;
    }

    // SAFETY: A non-null engine must have been returned by mobile_convex_engine_open.
    unsafe { (*engine).transaction_succeeded }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn mobile_convex_engine_close(engine: *mut MobileConvexEngine) {
    if !engine.is_null() {
        // SAFETY: Ownership is returned exactly once by the matching close call.
        drop(unsafe { Box::from_raw(engine) });
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn mobile_convex_engine_revision() -> *const c_char {
    CONVEX_REVISION.as_ptr().cast()
}
