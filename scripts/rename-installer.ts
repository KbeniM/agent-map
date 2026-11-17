// Tauri names the NSIS installer Rancher_<version>_<arch>-setup.exe with no option to change it.
import { existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dir, "../apps/desktop/src-tauri/target/release/bundle/nsis");
if (existsSync(dir)) {
  for (const file of readdirSync(dir).filter((f) => /^Rancher_.*-setup\.exe$/.test(f))) {
    renameSync(join(dir, file), join(dir, "RancherInstaller.exe"));
  }
}
