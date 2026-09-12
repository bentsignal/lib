Pod::Spec.new do |s|
  s.name             = 'MobileConvex'
  s.version          = '0.0.0'
  s.summary          = 'Experimental embedded Convex runtime for Expo'
  s.description      = 'Bridges an in-process Rust Convex persistence engine into Expo.'
  s.author           = 'lib'
  s.homepage         = 'https://github.com/bentsignal/lib'
  s.platforms        = { :ios => '16.4' }
  s.source           = { :git => 'https://github.com/bentsignal/lib.git' }
  s.static_framework = true
  s.swift_version    = '5.9'

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'CoreFoundation', 'Security'
  s.libraries = 'c++', 'iconv', 'sqlite3', 'z'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.vendored_libraries = 'lib/libmobile_convex_engine.a'
end
