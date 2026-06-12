import Foundation
import FieldUICore

// Conformances that make UIView, NSView, and custom types work with FieldField(in:)
// without the caller ever importing UIKit/AppKit directly through this API.

#if canImport(UIKit)
import UIKit

extension UIView: FieldMountPoint {
    public var fieldFrame: CGRect { bounds }
    public func addFieldSurface(_ surface: AnyObject) {
        if let layer = surface as? CALayer { self.layer.addSublayer(layer) }
        else if let view = surface as? UIView { addSubview(view) }
    }
    public func removeFieldSurface(_ surface: AnyObject) {
        if let layer = surface as? CALayer { layer.removeFromSuperlayer() }
        else if let view = surface as? UIView { view.removeFromSuperview() }
    }
}
#endif

#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit

extension NSView: FieldMountPoint {
    public var fieldFrame: CGRect { bounds }
    public func addFieldSurface(_ surface: AnyObject) {
        if let layer = surface as? CALayer { self.layer?.addSublayer(layer) }
        else if let view = surface as? NSView { addSubview(view) }
    }
    public func removeFieldSurface(_ surface: AnyObject) {
        if let layer = surface as? CALayer { layer.removeFromSuperlayer() }
        else if let view = surface as? NSView { view.removeFromSuperview() }
    }
}
#endif
