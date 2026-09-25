# NeoVirus Loader

NeoVirus Loader is an advanced JavaScript loader and runtime system for Silicon.

NeoVirus is an independent loader. It is **not** Fabric Loader and does not claim to boot Fabric.

## Features

NeoVirus performs real loader work:

- environment validation
- module registration
- module metadata and versions
- required and optional dependencies
- dependency graph resolution
- circular dependency detection
- synchronous or asynchronous module initialization
- module lifecycle states
- initialization rollback
- reverse-order shutdown
- loader lifecycle events
- progress and phase reporting
- structured error tracking
- runtime creation
- boot timing and boot counters
- Silicon integration

## Loader lifecycle

A normal boot follows this sequence:

```text
idle
  ↓
environment
  ↓
discovering
  ↓
resolving
  ↓
initializing
  ↓
starting
  ↓
ready / running
```

If a module fails, NeoVirus performs a rollback:

```text
initializing
  ↓
error
  ↓
rollback
  ↓
failed
```

## Module API

A module can provide metadata, dependencies, initialization, and shutdown:

```js
NeoVirusLoader.registerModule("graphics", {
    name: "Graphics",
    version: "1.0.0",

    dependencies: ["neovirus-core"],

    optionalDependencies: ["audio"],

    async init(runtime) {
        runtime.data.graphics = {
            initialized: true
        };

        return true;
    },

    async dispose(runtime) {
        if (runtime) {
            runtime.data.graphics = null;
        }
    }
});
```

### Required dependencies

A required dependency must exist:

```js
dependencies: ["neovirus-core"]
```

If it is missing, startup fails.

### Optional dependencies

An optional dependency is initialized when available but does not prevent startup when absent:

```js
optionalDependencies: ["audio"]
```

### Initialization failure

Returning `false` or throwing an error causes the module to fail and NeoVirus to roll back previously initialized modules.

## Runtime API

The runtime passed to modules provides:

```js
runtime.getState();
runtime.getModule("module-id");
runtime.emit("customEvent", data);
runtime.modules;
runtime.data;
```

## Loader API

The global loader is available as:

```js
globalThis.NeoVirusLoader
```

Useful methods include:

```js
NeoVirusLoader.registerModule(name, module);
NeoVirusLoader.unregisterModule(name);
NeoVirusLoader.hasModule(name);
NeoVirusLoader.getModule(name);
NeoVirusLoader.listModules();
NeoVirusLoader.moduleInfo(name);

NeoVirusLoader.boot(options);
NeoVirusLoader.unload();

NeoVirusLoader.getState();
NeoVirusLoader.getPhase();
NeoVirusLoader.getProgress();
NeoVirusLoader.getStatus();
NeoVirusLoader.getError();
NeoVirusLoader.getErrors();
NeoVirusLoader.getRuntime();
NeoVirusLoader.isReady();
```

## Events

NeoVirus supports lifecycle events:

```js
NeoVirusLoader.on("state", callback);
NeoVirusLoader.on("modulesResolved", callback);
NeoVirusLoader.on("moduleInitializing", callback);
NeoVirusLoader.on("moduleLoaded", callback);
NeoVirusLoader.on("moduleUnloaded", callback);
NeoVirusLoader.on("ready", callback);
NeoVirusLoader.on("error", callback);
NeoVirusLoader.on("failed", callback);
NeoVirusLoader.on("shutdown", callback);
```

An event subscription returns a function that removes that listener:

```js
const stopListening = NeoVirusLoader.on("ready", () => {
    console.log("NeoVirus is ready.");
});

stopListening();
```

## Status

```js
NeoVirusLoader.status();
```

Returns an object containing:

- loader
- version
- state
- phase
- progress
- status
- error
- modules
- initialized modules
- boot count

## Silicon integration

NeoVirus exposes:

```js
globalThis.SiliconLoaders.neovirus
```

with:

```js
boot(context)
unload()
state()
phase()
status()
error()
progress()
on(event, callback)
version
```

Silicon can therefore display the **real NeoVirus loader state** rather than inventing progress.

## Environment validation

A host can request required globals:

```js
NeoVirusLoader.boot({
    requiredGlobals: ["SomeHostAPI"]
});
```

NeoVirus will refuse startup if a required global is unavailable.

## Example

```js
NeoVirusLoader.registerModule("example", {
    version: "1.0.0",

    init(runtime) {
        runtime.data.example = "loaded";
        return true;
    },

    dispose(runtime) {
        delete runtime.data.example;
    }
});

NeoVirusLoader.on("ready", status => {
    console.log("NeoVirus ready", status);
});

NeoVirusLoader.boot();
```

## Important

NeoVirus is its own loader/runtime system. It does not turn JavaScript into Fabric Loader and does not pretend that Fabric has started.

## License

See the repository license for the terms chosen by Cubes Studio.
