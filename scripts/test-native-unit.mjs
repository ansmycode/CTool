import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
for (const name of ["wolf-database-test", "wolf-runtime-test"]) {
  const exe=fileURLToPath(new URL(`../native/build/Release/${name}.exe`,import.meta.url));
  execFileSync(exe,[],{stdio:"inherit",windowsHide:true,timeout:30000});
}
