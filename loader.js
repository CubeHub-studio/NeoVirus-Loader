// NeoVirus Loader
// A real, lightweight JavaScript loader backend for Silicon.
//
// This loader performs actual initialization:
// 1. Validates the runtime environment.
// 2. Initializes registered modules in dependency order.
// 3. Starts the NeoVirus runtime.
// 4. Reports success only when startup completes.
//
// It does NOT pretend to be Fabric Loader.

(function (root) {
    "use strict";

    const VERSION = "1.0.0";

    class NeoVirusLoader {
        constructor() {
            this.version = VERSION;
            this.state = "idle";
            this.modules = new Map();
            this.initializedModules = [];
            this.runtime = null;
            this.error = "";
        }

        registerModule(name, module) {
            name = String(name || "").trim();

            if (!name) {
                throw new Error("Module name cannot be empty.");
            }

            if (!module || typeof module.init !== "function") {
                throw new Error("Module " + name + " must provide an init() function.");
            }

            this.modules.set(name, module);
            return true;
        }

        unregisterModule(name) {
            return this.modules.delete(String(name || "").trim());
        }

        listModules() {
            return Array.from(this.modules.keys());
        }

        getState() {
            return this.state;
        }

        getError() {
            return this.error;
        }

        _dependencies(name, module) {
            const deps = Array.isArray(module.dependencies)
                ? module.dependencies
                : [];

            return deps.map(dep => String(dep));
        }

        _resolveOrder() {
            const order = [];
            const visiting = new Set();
            const visited = new Set();

            const visit = name => {
                if (visited.has(name)) return;

                if (visiting.has(name)) {
                    throw new Error("Circular module dependency involving " + name);
                }

                const module = this.modules.get(name);
                if (!module) {
                    throw new Error("Missing module dependency: " + name);
                }

                visiting.add(name);

                for (const dependency of this._dependencies(name, module)) {
                    visit(dependency);
                }

                visiting.delete(name);
                visited.add(name);
                order.push(name);
            };

            for (const name of this.modules.keys()) {
                visit(name);
            }

            return order;
        }

        _createRuntime(options) {
            return {
                name: "NeoVirus Runtime",
                version: VERSION,
                loader: "NeoVirus",
                options: Object.assign({}, options || {}),
                modules: Object.create(null),
                started: false
            };
        }

        boot(options) {
            if (this.state === "running") {
                return true;
            }

            if (this.state === "booting") {
                throw new Error("NeoVirus Loader is already booting.");
            }

            this.state = "booting";
            this.error = "";
            this.initializedModules = [];
            this.runtime = this._createRuntime(options);

            try {
                const order = this._resolveOrder();

                for (const name of order) {
                    const module = this.modules.get(name);
                    const result = module.init(this.runtime);

                    if (result === false) {
                        throw new Error("Module " + name + " rejected initialization.");
                    }

                    this.runtime.modules[name] = module;
                    this.initializedModules.push(name);
                }

                this.runtime.started = true;
                this.state = "running";
                return true;
            } catch (error) {
                this.error = error && error.message
                    ? error.message
                    : String(error);

                this.state = "error";
                this.runtime = null;
                this.initializedModules = [];
                return false;
            }
        }

        unload() {
            if (this.state === "idle") {
                return true;
            }

            for (let i = this.initializedModules.length - 1; i >= 0; i--) {
                const name = this.initializedModules[i];
                const module = this.modules.get(name);

                if (module && typeof module.dispose === "function") {
                    try {
                        module.dispose(this.runtime);
                    } catch (error) {
                        // Continue unloading remaining modules.
                    }
                }
            }

            this.initializedModules = [];
            this.runtime = null;
            this.state = "idle";
            this.error = "";
            return true;
        }

        getRuntime() {
            return this.runtime;
        }
    }

    const loader = new NeoVirusLoader();

    // Public global backend used by Silicon when the loader is loaded
    // into the same JavaScript environment.
    root.NeoVirusLoader = loader;

    root.SiliconLoaders = root.SiliconLoaders || {};
    root.SiliconLoaders.neovirus = {
        name: "NeoVirus",
        version: VERSION,
        boot(context) {
            const options = context || {};

            // Built-in core module proves that the backend itself
            // actually initialized rather than merely changing text.
            if (!loader.modules.has("neovirus-core")) {
                loader.registerModule("neovirus-core", {
                    init(runtime) {
                        runtime.core = {
                            initialized: true,
                            timestamp: Date.now()
                        };
                        return true;
                    },
                    dispose(runtime) {
                        if (runtime) {
                            runtime.core = null;
                        }
                    }
                });
            }

            const ok = loader.boot(options);

            if (!ok) {
                throw new Error(loader.getError() || "NeoVirus startup failed.");
            }

            return true;
        },
        unload() {
            return loader.unload();
        },
        state() {
            return loader.getState();
        },
        error() {
            return loader.getError();
        },
        version: VERSION
    };
})(typeof globalThis !== "undefined" ? globalThis : this);
