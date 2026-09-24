# NeoVirus Loader

NeoVirus Loader is the loader backend for the NeoVirus runtime.

## What it does

NeoVirus Loader performs real initialization instead of simulating loader progress.

The backend:

- validates module definitions
- resolves module dependencies
- initializes modules in dependency order
- creates a NeoVirus runtime
- reports a running state only after initialization succeeds
- unloads initialized modules in reverse order
- reports initialization errors

## Silicon integration

The loader exposes:

`globalThis.SiliconLoaders.neovirus`

with:

- `boot(context)`
- `unload()`
- `state()`
- `error()`
- `version`

Silicon can therefore use this backend when the loader code is loaded into the same JavaScript environment.

## Important

NeoVirus is its own loader. It is **not** the Fabric Loader and does not claim to boot Fabric.

The current backend is JavaScript-based so it can run in a browser-compatible environment such as a Gandi extension sandbox.

## Module API

A module has this basic shape:

```js
{
    dependencies: ["another-module"],
    init(runtime) {
        runtime.myFeature = true;
        return true;
    },
    dispose(runtime) {
        runtime.myFeature = null;
    }
}
```

Register one with:

```js
NeoVirusLoader.registerModule("my-module", {
    init(runtime) {
        runtime.myFeature = true;
        return true;
    }
});
```

Then boot:

```js
NeoVirusLoader.boot();
```

Check state:

```js
NeoVirusLoader.getState();
```

Possible states are:

- `idle`
- `booting`
- `running`
- `error`

## License

See the repository license for the terms chosen by Cubes Studio.
