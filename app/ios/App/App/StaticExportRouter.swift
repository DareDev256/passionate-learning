import Capacitor
import Foundation

/// Serves the page Next's static export wrote for each route.
///
/// Capacitor's own router answers every path without an extension with the root index.html (a single-page-app
/// fallback), so a document load of /w/prompt/ renders Home. The export has trailingSlash, so every route has its
/// own <route>/index.html: serve that file when it exists, and the root index.html otherwise. Paths with an
/// extension (scripts, styles, images, payloads) are served as they are, the same as Capacitor does.
struct StaticExportRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        guard URL(fileURLWithPath: path).pathExtension.isEmpty else { return basePath + path }
        let route = path.hasSuffix("/") ? String(path.dropLast()) : path
        let page = basePath + route + "/index.html"
        return FileManager.default.fileExists(atPath: page) ? page : basePath + "/index.html"
    }
}
