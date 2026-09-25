// NeoVirus Verification Module
(function (root) {
    "use strict";

    const loader = root.NeoVirusLoader;
    if (!loader) throw new Error("NeoVirusLoader is not available.");

    loader.registerModule("neovirus-verifier", {
        name: "NeoVirus Verifier",
        version: "1.0.0",
        dependencies: ["neovirus-runtime"],

        init(runtime) {
            const required = [
                "neovirus-core",
                "neovirus-environment",
                "neovirus-runtime"
            ];

            const missing = required.filter(name => !loader.hasModule(name));

            if (missing.length) {
                throw new Error("Required loader modules are missing: " + missing.join(", "));
            }

            runtime.data.verification = {
                passed: true,
                checked: required,
                timestamp: Date.now()
            };

            runtime.emit("verificationComplete", {
                checked: required.length,
                passed: true
            });

            return true;
        },

        dispose(runtime) {
            if (runtime) runtime.data.verification = null;
        }
    });
})(typeof globalThis !== "undefined" ? globalThis : this);
