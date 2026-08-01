import Capacitor
import Foundation

@objc(LinkStoragePlugin)
final class LinkStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LinkStoragePlugin"
    let jsName = "LinkStorage"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getOverview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTemporaryFiles", returnType: CAPPluginReturnPromise)
    ]

    private struct DirectoryStats {
        var bytes = 0
        var fileCount = 0

        mutating func add(_ other: DirectoryStats) {
            bytes += other.bytes
            fileCount += other.fileCount
        }
    }

    @objc func getOverview(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self else { return }
            call.resolve(self.buildOverview())
        }
    }

    @objc func clearTemporaryFiles(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self else { return }
            do {
                try self.clearDirectoryContents(self.cacheDirectoryURL())
                try self.clearKnownTemporaryBackups()
                call.resolve(self.buildOverview())
            } catch {
                call.reject("清理 App 临时文件失败。", nil, error)
            }
        }
    }

    private func buildOverview() -> [String: Any] {
        var cacheStats = directoryStats(for: cacheDirectoryURL())
        cacheStats.add(directoryStats(for: FileManager.default.temporaryDirectory))

        let storageURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? cacheDirectoryURL()
        let values = try? storageURL.resourceValues(forKeys: [
            .volumeAvailableCapacityForImportantUsageKey,
            .volumeTotalCapacityKey
        ])
        return [
            "platform": "ios",
            "availableBytes": values?.volumeAvailableCapacityForImportantUsage ?? 0,
            "totalBytes": values?.volumeTotalCapacity ?? 0,
            "cacheBytes": cacheStats.bytes,
            "cacheFileCount": cacheStats.fileCount
        ]
    }

    private func cacheDirectoryURL() -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
    }

    private func directoryStats(for directory: URL) -> DirectoryStats {
        let manager = FileManager.default
        guard let enumerator = manager.enumerator(at: directory, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]) else {
            return DirectoryStats()
        }

        var stats = DirectoryStats()
        for case let fileURL as URL in enumerator {
            let values = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
            guard values?.isRegularFile == true else { continue }
            stats.bytes += values?.fileSize ?? 0
            stats.fileCount += 1
        }
        return stats
    }

    private func clearDirectoryContents(_ directory: URL) throws {
        let manager = FileManager.default
        let children = try manager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        for child in children {
            try manager.removeItem(at: child)
        }
    }

    private func clearKnownTemporaryBackups() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("BabyLinkBackups", isDirectory: true)
        guard FileManager.default.fileExists(atPath: directory.path) else { return }
        try FileManager.default.removeItem(at: directory)
    }
}