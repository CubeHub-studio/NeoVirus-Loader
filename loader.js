// NeoVirus Loader
// Advanced JavaScript runtime/module loader for Silicon.
//
// NeoVirus performs real work:
// - environment validation
// - module registration and metadata
// - dependency resolution
// - lifecycle events
// - synchronous or asynchronous module initialization
// - progress/state reporting
// - failure tracking and rollback
// - orderly shutdown
//
// NeoVirus is an independent loader. It does not pretend to be Fabric.

(function (root) {
    "use strict";

    const VERSION = "1.1.0";

    class NeoVirusLoader {
        constructor() {
            this.version = VERSION;
            this.state = "idle";
            this.phase = "idle";
            this.modules = new Map();
            this.initializedModules = [];
            this.runtime = null;
            this.error = "";
            this.errors = [];
            this.events = [];
            this.listeners = new Map();
            this.progress = 0;
            this.status = "NeoVirus ready";
            this.startedAt = 0;
            this.finishedAt = 0;
            this.bootCount = 0;
        }

        registerModule(name, module) {
            name = String(name || "").trim();

            if (!name) {
                throw new Error("Module name cannot be empty.");
            }

            if (!module || typeof module.init !== "function") {
                throw new Error("Module " + name + " must provide an init() function.");
            }

            const dependencies = Array.isArray(module.dependencies)
                ? module.dependencies.map(dep => String(dep).trim()).filter(Boolean)
                : [];

            this.modules.set(name, {
                id: name,
                name: String(module.name || name),
                version: String(module.version || "1.0.0"),
                dependencies,
                optionalDependencies: Array.isArray(module.optionalDependencies)
                    ? module.optionalDependencies.map(dep => String(dep).trim()).filter(Boolean)
                    : [],
                init: module.init,
                dispose: typeof module.dispose === "function" ? module.dispose : null,
                state: "registered",
                error: "",
                initializedAt: 0
            });

            return true;
        }

        unregisterModule(name) {
            return this.modules.delete(String(name || "").trim());
        }

        hasModule(name) {
            return this.modules.has(String(name || "").trim());
        }

        getModule(name) {
            return this.modules.get(String(name || "").trim()) || null;
        }

        listModules() {
            return Array.from(this.modules.keys());
        }

        moduleInfo(name) {
            const module = this.getModule(name);
            if (!module) return null;

            return {
                id: module.id,
                name: module.name,
                version: module.version,
                dependencies: module.dependencies.slice(),
                optionalDependencies: module.optionalDependencies.slice(),
                state: module.state,
                error: module.error
            };
        }

        getState() {
            return this.state;
        }

        getPhase() {
            return this.phase;
        }

        getError() {
            return this.error;
        }

        getErrors() {
            return this.errors.slice();
        }

        getProgress() {
            return Math.round(this.progress);
        }

        getStatus() {
            return this.status;
        }

        getRuntime() {
            return this.runtime;
        }

        isReady() {
            return this.state === "running";
        }

        on(event, callback) {
            event = String(event || "").trim();

            if (!event || typeof callback !== "function") {
                throw new Error("NeoVirus events require an event name and callback.");
            }

            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }

            this.listeners.get(event).add(callback);

            return () => {
                const listeners = this.listeners.get(event);
                if (listeners) listeners.delete(callback);
            };
        }

        off(event, callback) {
            const listeners = this.listeners.get(String(event || "").trim());
            return !!(listeners && listeners.delete(callback));
        }

        _emit(event, data) {
            this.events.push({
                event,
                data: data || null,
                timestamp: Date.now()
            });

            if (this.events.length > 100) {
                this.events.shift();
            }

            const listeners = this.listeners.get(event);
            if (!listeners) return;

            for (const callback of Array.from(listeners)) {
                try {
                    callback(data || {});
                } catch (error) {
                    this._recordError("Event listener " + event + " failed: " + this._errorMessage(error));
                }
            }
        }

        _setState(state, phase, status, progress) {
            this.state = state;
            this.phase = phase;
            this.status = status;

            if (progress !== undefined) {
                this.progress = Math.max(0, Math.min(100, Number(progress) || 0));
            }

            this._emit("state", {
                state: this.state,
                phase: this.phase,
                status: this.status,
                progress: this.progress
            });
        }

        _recordError(message, moduleName) {
            const entry = {
                message: String(message),
                module: moduleName || "",
                timestamp: Date.now()
            };

            this.errors.push(entry);

            if (this.errors.length > 50) {
                this.errors.shift();
            }

            this.error = entry.message;
            this._emit("error", entry);
        }

        _errorMessage(error) {
            return error && error.message ? error.message : String(error);
        }

        _dependencies(name, module) {
            return module.dependencies.slice();
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

                for (const dependency of module.optionalDependencies) {
                    if (this.modules.has(dependency)) {
                        visit(dependency);
                    }
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

        _validateEnvironment(options) {
            if (typeof Promise === "undefined") {
                throw new Error("NeoVirus requires Promise support.");
            }

            const requiredGlobals = options && Array.isArray(options.requiredGlobals)
                ? options.requiredGlobals
                : [];

            for (const globalName of requiredGlobals) {
                if (!(String(globalName) in root)) {
                    throw new Error("Required global is missing: " + globalName);
                }
            }

            return true;
        }

        _createRuntime(options) {
            const loader = this;

            return {
                name: "NeoVirus Runtime",
                version: VERSION,
                loader: "NeoVirus",
                options: Object.assign({}, options || {}),
                modules: Object.create(null),
                data: Object.create(null),
                started: false,

                getState() {
                    return loader.getState();
                },

                getModule(name) {
                    return loader.getModule(name);
                },

                emit(event, data) {
                    loader._emit(event, data);
                }
            };
        }

        async boot(options) {
            if (this.state === "running") {
                return true;
            }

            if (this.state === "booting") {
                throw new Error("NeoVirus Loader is already booting.");
            }

            this.state = "booting";
            this.phase = "starting";
            this.error = "";
            this.errors = [];
            this.initializedModules = [];
            this.startedAt = Date.now();
            this.finishedAt = 0;
            this.bootCount++;
            this.runtime = this._createRuntime(options);

            try {
                this._setState("booting", "environment", "Checking NeoVirus environment", 5);
                this._validateEnvironment(options);

                this._setState("booting", "discovering", "Discovering modules", 15);

                const order = this._resolveOrder();

                this._setState(
                    "booting",
                    "resolving",
                    "Resolving module dependencies",
                    order.length ? 25 : 40
                );

                this._emit("modulesResolved", {
                    order: order.slice()
                });

                const total = order.length || 1;

                for (let index = 0; index < order.length; index++) {
                    const name = order[index];
                    const module = this.modules.get(name);

                    module.state = "initializing";
                    module.error = "";

                    const progress = 30 + Math.round(((index) / total) * 55);

                    this._setState(
                        "booting",
                        "initializing",
                        "Initializing module: " + name,
                        progress
                    );

                    this._emit("moduleInitializing", {
                        id: name,
                        version: module.version,
                        index,
                        total
                    });

                    try {
                        const result = await module.init(this.runtime);

                        if (result === false) {
                            throw new Error("Module " + name + " rejected initialization.");
                        }

                        module.state = "running";
                        module.initializedAt = Date.now();
                        this.runtime.modules[name] = module;
                        this.initializedModules.push(name);

                        this._emit("moduleLoaded", {
                            id: name,
                            version: module.version,
                            index: index + 1,
                            total
                        });
                    } catch (error) {
                        module.state = "error";
                        module.error = this._errorMessage(error);
                        this._recordError(module.error, name);
                        throw new Error("Module " + name + " failed: " + module.error);
                    }
                }

                this._setState("booting", "starting", "Starting NeoVirus runtime", 92);

                this.runtime.started = true;

                this._setState("running", "ready", "NeoVirus ready", 100);

                this.finishedAt = Date.now();

                this._emit("ready", {
                    modules: this.initializedModules.slice(),
                    bootTime: this.finishedAt - this.startedAt
                });

                return true;
            } catch (error) {
                this._recordError(this._errorMessage(error));

                await this._rollback();

                this.state = "error";
                this.phase = "error";
                this.progress = 100;
                this.status = "NeoVirus startup failed";
                this.finishedAt = Date.now();

                this._emit("failed", {
                    error: this.error,
                    modules: this.initializedModules.slice()
                });

                return false;
            }
        }

        async _rollback() {
            this._setState(
                "stopping",
                "rollback",
                "Rolling back initialized modules",
                this.progress
            );

            for (let i = this.initializedModules.length - 1; i >= 0; i--) {
                const name = this.initializedModules[i];
                const module = this.modules.get(name);

                if (!module || !module.dispose) continue;

                try {
                    await module.dispose(this.runtime);
                    module.state = "registered";
                } catch (error) {
                    module.state = "error";
                    module.error = this._errorMessage(error);
                    this._recordError(
                        "Rollback failed for " + name + ": " + module.error,
                        name
                    );
                }
            }

            this.initializedModules = [];

            if (this.runtime) {
                this.runtime.started = false;
            }
        }

        async unload() {
            if (this.state === "idle") {
                return true;
            }

            this._setState("stopping", "shutdown", "Stopping NeoVirus runtime", 100);

            for (let i = this.initializedModules.length - 1; i >= 0; i--) {
                const name = this.initializedModules[i];
                const module = this.modules.get(name);

                if (!module || !module.dispose) continue;

                try {
                    await module.dispose(this.runtime);
                    module.state = "registered";
                    this._emit("moduleUnloaded", {id: name});
                } catch (error) {
                    module.state = "error";
                    module.error = this._errorMessage(error);
                    this._recordError(
                        "Module " + name + " shutdown failed: " + module.error,
                        name
                    );
                }
            }

            if (this.runtime) {
                this.runtime.started = false;
            }

            this.initializedModules = [];
            this.runtime = null;
            this.state = "idle";
            this.phase = "idle";
            this.progress = 0;
            this.status = "NeoVirus ready";
            this.error = "";
            this.finishedAt = Date.now();

            this._emit("shutdown", {});

            return true;
        }

        status() {
            return {
                loader: "NeoVirus",
                version: VERSION,
                state: this.state,
                phase: this.phase,
                progress: this.getProgress(),
                status: this.status,
                error: this.error,
                modules: this.listModules(),
                initialized: this.initializedModules.slice(),
                bootCount: this.bootCount
            };
        }
    }

    const loader = new NeoVirusLoader();

    // Core module: proves the loader's own module system is executing.
    loader.registerModule("neovirus-core", {
        name: "NeoVirus Core",
        version: VERSION,
        init(runtime) {
            runtime.data.core = {
                initialized: true,
                timestamp: Date.now()
            };
            return true;
        },
        dispose(runtime) {
            if (runtime) {
                runtime.data.core = null;
            }
        }
    });

    // Public global loader API.
    root.NeoVirusLoader = loader;

    root.SiliconLoaders = root.SiliconLoaders || {};
    root.SiliconLoaders.neovirus = {
        name: "NeoVirus",
        version: VERSION,

        async boot(context) {
            const options = Object.assign({}, context || {});

            const ok = await loader.boot(options);

            if (!ok) {
                throw new Error(loader.getError() || "NeoVirus startup failed.");
            }

            return true;
        },

        async unload() {
            return loader.unload();
        },

        state() {
            return loader.getState();
        },

        phase() {
            return loader.getPhase();
        },

        status() {
            return loader.status();
        },

        error() {
            return loader.getError();
        },

        progress() {
            return loader.getProgress();
        },

        on(event, callback) {
            return loader.on(event, callback);
        },

        version: VERSION
    };
})(typeof globalThis !== "undefined" ? globalThis : this);
