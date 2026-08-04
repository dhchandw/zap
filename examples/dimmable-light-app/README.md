# Matter dimmable light (via `zap edit`)

Matter application configuration built with the `zap edit` CLI:

| Endpoint | Device type | Role |
| -------- | ----------- | ---- |
| 0 | `MA-rootdevice` (0x0016) | Matter root node (added by `new`) |
| 1 | `MA-dimmablelight` (0x0101) | Dimmable light |

Endpoint 1 enables Identify, Groups, Scenes, On/Off, Level Control, and Descriptor.
`CurrentLevel` default is **25**; `MoveToLevel` is enabled as an incoming command.

## Recreate

From a built source tree (`npx tsc --build ./tsconfig.json`):

```bash
./examples/dimmable-light-app/create.sh
```

Or step by step:

```bash
MATTER="--zcl ./zcl-builtin/matter/zcl.json --gen ./test/gen-template/matter/gen-test.json"
ZAP="node --unhandled-rejections=strict dist/src-electron/main-process/main.js"

$ZAP edit apply examples/dimmable-light-app/light.zap --new \
  --script examples/dimmable-light-app/light.yaml $MATTER

$ZAP generate examples/dimmable-light-app/light.zap \
  -o examples/dimmable-light-app/gen $MATTER
```

Generated files land in `gen/` (local only; not committed).
