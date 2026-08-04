import Capacitor
import Foundation
import Photos

@objc(LinkMediaPlugin)
final class LinkMediaPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "LinkMediaPlugin"
    let jsName = "LinkMedia"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    private let maximumEncodedImageLength = 48 * 1024 * 1024

    @objc func saveImage(_ call: CAPPluginCall) {
        let dataUrl = call.getString("dataUrl") ?? ""
        let requestedFileName = call.getString("fileName") ?? "link-image.png"
        guard let image = decodeImage(dataUrl) else {
            call.reject("图片数据无效或超过 36MB。")
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.requestPhotoLibraryAccess(for: call, image: image, fileName: self?.sanitizeFileName(requestedFileName, mimeType: image.mimeType) ?? "link-image.png")
        }
    }

    private func requestPhotoLibraryAccess(for call: CAPPluginCall, image: (data: Data, mimeType: String), fileName: String) {
        switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized, .limited:
            save(image: image, fileName: fileName, call: call)
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
                DispatchQueue.main.async {
                    guard let self else { return }
                    guard status == .authorized || status == .limited else {
                        call.reject("需要允许“添加照片”权限才能保存图片。")
                        return
                    }
                    self.save(image: image, fileName: fileName, call: call)
                }
            }
        case .denied, .restricted:
            call.reject("需要允许“添加照片”权限才能保存图片。")
        @unknown default:
            call.reject("无法获取相册权限状态。")
        }
    }

    private func save(image: (data: Data, mimeType: String), fileName: String, call: CAPPluginCall) {
        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetCreationRequest.forAsset()
            let options = PHAssetResourceCreationOptions()
            options.originalFilename = fileName
            request.addResource(with: .photo, data: image.data, options: options)
        }) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve([
                        "saved": true,
                        "fileName": fileName
                    ])
                } else {
                    call.reject("图片保存失败。", nil, error)
                }
            }
        }
    }

    private func decodeImage(_ dataUrl: String) -> (data: Data, mimeType: String)? {
        guard dataUrl.count <= maximumEncodedImageLength,
              let commaIndex = dataUrl.firstIndex(of: ",") else {
            return nil
        }
        let header = String(dataUrl[..<commaIndex]).lowercased()
        guard header.hasPrefix("data:image/"), header.contains(";base64"),
              let mimeType = header.dropFirst(5).split(separator: ";", maxSplits: 1).first.map(String.init),
              ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].contains(mimeType),
              let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: commaIndex)...]), options: .ignoreUnknownCharacters),
              !data.isEmpty else {
            return nil
        }
        return (data, mimeType)
    }

    private func sanitizeFileName(_ requestedFileName: String, mimeType: String) -> String {
        let invalidCharacters = CharacterSet(charactersIn: "\\/:*?\"<>|")
        var fileName = requestedFileName
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: invalidCharacters)
            .joined(separator: "-")
        if fileName.isEmpty { fileName = "link-image" }
        if fileName.range(of: #"\.(png|jpe?g|webp|gif)$"#, options: [.regularExpression, .caseInsensitive]) == nil {
            fileName += extensionForMimeType(mimeType)
        }
        return String(fileName.suffix(120))
    }

    private func extensionForMimeType(_ mimeType: String) -> String {
        if mimeType.contains("png") { return ".png" }
        if mimeType.contains("webp") { return ".webp" }
        if mimeType.contains("gif") { return ".gif" }
        return ".jpg"
    }
}