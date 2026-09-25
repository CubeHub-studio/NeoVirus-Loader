// NeoVirus Environment Module
(function (root) {
    "use strict";

    const loader = root.NeoVirusLoader;
    if (!loader) throw new Error("NeoVirusLoader is not available.");

    loader.registerModule("neovirus-environment", {
        name: "NeoVirus Environment",
        version: "1.0.0",
        dependencies: ["neovirus-core"],

        init(runtime) {
            const checks = {
                promise: typeof Promise !== "undefined",
                fetch: typeof root.fetch === "function",
                timers: typeof root.setTimeout === "function",
                performance: typeof root.performance !== "undefined",
                globalThis: typeof root.globalThis !== "undefined"
            };

            const failed = Object.keys(checks).filter(key => !checks[key]);

            runtime.data.environment = {
                checks,
                passed: failed.length === 0,
                failed,
                timestamp: Date.now()
            };

            if (failed.length) {
                throw new Error("Environment checks failed: " + failed.join(", "));
            }

            return true;
        },

        dispose(runtime) {
            if (runtime) runtime.data.environment = null;
        }
    });
})(typeof globalThis !== "undefined" ? globalThis : this);
