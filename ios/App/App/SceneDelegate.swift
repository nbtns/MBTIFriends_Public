import UIKit
import Capacitor

@objc(BirthdayPickerPlugin)
public class BirthdayPickerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BirthdayPickerPlugin"
    public let jsName = "BirthdayPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise)
    ]

    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else {
                call.reject("生年月日選択を表示できません")
                return
            }
            guard presenter.presentedViewController == nil else {
                call.reject("別の画面を表示中です")
                return
            }

            let picker = BirthdayPickerViewController(
                value: call.getString("value"),
                minimum: call.getString("minimum"),
                maximum: call.getString("maximum")
            ) { value in
                if let value {
                    call.resolve(["value": value])
                } else {
                    call.resolve(["cancelled": true])
                }
            }
            presenter.present(picker, animated: true)
        }
    }
}

private final class BirthdayPickerViewController: UIViewController {
    private let picker = UIDatePicker()
    private let completion: (String?) -> Void

    init(value: String?, minimum: String?, maximum: String?, completion: @escaping (String?) -> Void) {
        self.completion = completion
        super.init(nibName: nil, bundle: nil)

        picker.calendar = Calendar(identifier: .gregorian)
        picker.locale = Locale(identifier: "ja_JP")
        picker.timeZone = .current
        picker.datePickerMode = .date
        picker.preferredDatePickerStyle = .wheels
        picker.minimumDate = Self.parse(minimum) ?? Self.parse("1900-01-01")
        picker.maximumDate = Self.parse(maximum) ?? Date()
        picker.date = Self.parse(value) ?? Self.parse("2010-01-01") ?? Date()

        modalPresentationStyle = .pageSheet
        isModalInPresentation = true
        if let sheet = sheetPresentationController {
            sheet.detents = [.medium()]
            sheet.prefersGrabberVisible = true
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 1, green: 250 / 255, blue: 243 / 255, alpha: 1)

        let titleLabel = UILabel()
        titleLabel.text = "生年月日"
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.textAlignment = .center

        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("キャンセル", for: .normal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let doneButton = UIButton(type: .system)
        doneButton.setTitle("決定", for: .normal)
        doneButton.titleLabel?.font = .boldSystemFont(ofSize: 17)
        doneButton.addTarget(self, action: #selector(done), for: .touchUpInside)

        [titleLabel, cancelButton, doneButton, picker].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }

        NSLayoutConstraint.activate([
            cancelButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
            doneButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            doneButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor),
            picker.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            picker.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            picker.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 12),
            picker.heightAnchor.constraint(equalToConstant: 216)
        ])
    }

    @objc private func cancel() {
        dismiss(animated: true) { self.completion(nil) }
    }

    @objc private func done() {
        let value = Self.format(picker.date)
        dismiss(animated: true) { self.completion(value) }
    }

    private static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    private static func format(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

private final class TomoTypeBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardDidHide),
            name: UIResponder.keyboardDidHideNotification,
            object: nil
        )
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BirthdayPickerPlugin())
    }

    @objc private func keyboardDidHide() {
        webView?.evaluateJavaScript("document.activeElement instanceof HTMLElement && document.activeElement.blur()")
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = TomoTypeBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
