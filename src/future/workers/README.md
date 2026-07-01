# CryoPlan Web Workers Repository

To prevent rendering lags on the OpenLayers interactive thread, CPU-heavy algorithms should run inside dedicated background workers:
- `routePlanner.worker.ts` - runs pathfinding networks in the background.
- `deconvolution.worker.ts` - deconvolves radar raw waves outside the main loop.
