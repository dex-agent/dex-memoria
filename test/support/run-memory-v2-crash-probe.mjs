import * as fsPromises from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { executeMemoryRoute } = require("../../bin/memory-v2-route-executor.js");

const probePath = process.argv[2];
if (probePath) {
  const probe = JSON.parse(await readFile(probePath, "utf8"));
  const crashingFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      const result = await fsPromises.rename(source, destination);
      if (destination === probe.destination) process.kill(process.pid, "SIGKILL");
      return result;
    }
  };

  const entrypointRealpath = realpathSync.native(process.argv[1]);
  await executeMemoryRoute(probe.route, probe.candidate, {
    file_system: crashingFileSystem,
    producer_provenance: {
      entrypoint_realpath: entrypointRealpath,
      entrypoint_sha256: createHash("sha256").update(await readFile(entrypointRealpath)).digest("hex")
    }
  });
  process.exitCode = 91;
}
