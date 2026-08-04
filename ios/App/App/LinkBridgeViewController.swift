import Capacitor

@objc(LinkBridgeViewController)
final class LinkBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(LinkBackupPlugin.self)
        bridge?.registerPluginType(LinkMediaPlugin.self)
        bridge?.registerPluginType(LinkStoragePlugin.self)
    }
}
