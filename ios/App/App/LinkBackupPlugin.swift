import Capacitor
import Foundation
import UIKit

@objc(LinkBackupPlugin)
final class LinkBackupPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "LinkBackupPlugin"
    let jsName = "LinkBackup"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "beginArchive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendArchiveChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishArchive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abortArchive", returnType: CAPPluginReturnPromise)
    ]

    private final class ArchiveSession {
        let id: String
        let fileName: String
        let expectedBytes: Int
        let fileURL: URL
        let handle: FileHandle
        var writtenBytes = 0

        init(id: String, fileName: String, expectedBytes: Int, fileURL: URL, handle: FileHandle) {
            self.id = id
            self.fileName = fileName
            self.expectedBytes = expectedBytes
            self.fileURL = fileURL
            self.handle = handle
        }
    }

    private let archiveQueue = DispatchQueue(label: "top.babylink.backup.writer")
    private var sessions: [String: ArchiveSession] = [:]
    private var pendingExportCall: CAPPluginCall?
    private var pendingExportURL: URL?

    @objc func beginArchive(_ call: CAPPluginCall) {
        let fileName = sanitizeFileName(call.getString("fileName") ?? "link-backup.zip")
        let totalBytes = call.getInt("totalBytes") ?? 0
        guard totalBytes > 0, totalBytes <= 1024 * 1024 * 1024 else {
            call.reject("备份大小无效或超过 1GB。")
            return
        }

        archiveQueue.async { [weak self] in
            guard let self else { return }
            do {
                let sessionID = UUID().uuidString
                let directoryURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent("BabyLinkBackups", isDirectory: true)
                    .appendingPathComponent(sessionID, isDirectory: true)
                try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
                let fileURL = directoryURL.appendingPathComponent(fileName, isDirectory: false)
                guard FileManager.default.createFile(atPath: fileURL.path, contents: nil) else {
                    throw CocoaError(.fileWriteUnknown)
                }
                let session = ArchiveSession(
                    id: sessionID,
                    fileName: fileName,
                    expectedBytes: totalBytes,
                    fileURL: fileURL,
                    handle: try FileHandle(forWritingTo: fileURL)
                )
                self.sessions[sessionID] = session
                call.resolve([
                    "sessionId": sessionID,
                    "fileName": fileName,
                    "location": "系统文件 App"
                ])
            } catch {
                call.reject("无法创建临时备份文件。", nil, error)
            }
        }
    }

    @objc func appendArchiveChunk(_ call: CAPPluginCall) {
        let sessionID = call.getString("sessionId") ?? ""
        let encodedData = call.getString("data") ?? ""
        guard !sessionID.isEmpty, !encodedData.isEmpty, encodedData.count <= 2 * 1024 * 1024 else {
            call.reject("备份分片无效。")
            return
        }

        archiveQueue.async { [weak self] in
            guard let self else { return }
            guard let session = self.sessions[sessionID] else {
                call.reject("备份写入会话已失效。")
                return
            }
            do {
                guard let data = Data(base64Encoded: encodedData, options: .ignoreUnknownCharacters) else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                guard session.writtenBytes + data.count <= session.expectedBytes else {
                    throw CocoaError(.fileWriteOutOfSpace)
                }
                try session.handle.write(contentsOf: data)
                session.writtenBytes += data.count
                call.resolve(["writtenBytes": session.writtenBytes])
            } catch {
                self.sessions.removeValue(forKey: sessionID)
                self.removeSessionFile(session)
                call.reject("备份分片写入失败。", nil, error)
            }
        }
    }

    @objc func finishArchive(_ call: CAPPluginCall) {
        let sessionID = call.getString("sessionId") ?? ""
        archiveQueue.async { [weak self] in
            guard let self else { return }
            guard let session = self.sessions.removeValue(forKey: sessionID) else {
                call.reject("备份写入会话已失效。")
                return
            }
            do {
                guard session.writtenBytes == session.expectedBytes else {
                    throw CocoaError(.fileWriteUnknown)
                }
                try session.handle.synchronize()
                try session.handle.close()
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    guard self.pendingExportCall == nil else {
                        self.removeSessionFile(session)
                        call.reject("已有备份正在等待保存。")
                        return
                    }
                    let picker = UIDocumentPickerViewController(forExporting: [session.fileURL], asCopy: true)
                    picker.delegate = self
                    picker.shouldShowFileExtensions = true
                    self.pendingExportCall = call
                    self.pendingExportURL = session.fileURL
                    self.bridge?.viewController?.present(picker, animated: true)
                }
            } catch {
                self.removeSessionFile(session)
                call.reject("备份文件写入不完整。", nil, error)
            }
        }
    }

    @objc func abortArchive(_ call: CAPPluginCall) {
        let sessionID = call.getString("sessionId") ?? ""
        archiveQueue.async { [weak self] in
            guard let self else { return }
            if let session = self.sessions.removeValue(forKey: sessionID) {
                self.removeSessionFile(session)
            }
            call.resolve()
        }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let exportedURL = urls.first
        let call = pendingExportCall
        cleanupPendingExport()
        call?.resolve([
            "saved": true,
            "fileName": exportedURL?.lastPathComponent ?? "link-backup.zip",
            "location": exportedURL?.path ?? "系统文件 App"
        ])
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let call = pendingExportCall
        cleanupPendingExport()
        call?.reject("已取消保存备份。")
    }

    private func cleanupPendingExport() {
        if let url = pendingExportURL {
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
        }
        pendingExportURL = nil
        pendingExportCall = nil
    }

    private func removeSessionFile(_ session: ArchiveSession) {
        try? session.handle.close()
        try? FileManager.default.removeItem(at: session.fileURL.deletingLastPathComponent())
    }

    private func sanitizeFileName(_ requestedName: String) -> String {
        let invalidCharacters = CharacterSet(charactersIn: "\\/:*?\"<>|")
        var fileName = requestedName
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: invalidCharacters)
            .joined(separator: "-")
        if fileName.isEmpty { fileName = "link-backup" }
        if !fileName.lowercased().hasSuffix(".zip") { fileName += ".zip" }
        return String(fileName.suffix(160))
    }
}
