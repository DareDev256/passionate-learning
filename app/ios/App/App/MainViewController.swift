import Capacitor
import UIKit

/// Capacitor's bridge view controller with a router that serves each route's own page from the static export.
class MainViewController: CAPBridgeViewController {
    override func router() -> Router {
        StaticExportRouter()
    }
}
