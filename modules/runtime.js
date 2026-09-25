// NeoVirus Runtime Services Module
(function (root) {
    "use strict";

    const loader = root.NeoVirusLoader;
    if (!loader) throw new Error("NeoVirusLoader is not available.");

    loader.registerModule("neovirus-runtime", {
        name: "NeoVirus Runtime Services",
        version: "1.0.0",
        dependencies: ["neovirus-environment"],

        init(runtime) {
            const services = {
                startedAt: Date.now(),
                timers: 0,
                tasks: 0,
                emit(event, data) {
                    runtime.emit(event, data);
                },
                schedule(task) {
                    if (typeof task !== "function") {
                        throw new Error("Runtime task must be a function.");
                    }

                    services.tasks++;
                    return Promise.resolve().then(() => task(runtime));
                }
            };

            runtime.data.services = services;
            runtime.emit("runtimeServicesReady", {
                services: ["timers", "tasks", "events"]
            });

            return true;
        },

        dispose(runtime) {
            if (runtime) runtime.data.services = null;
        }
    });
})(typeof globalThis !== "undefined" ? globalThis : this);
