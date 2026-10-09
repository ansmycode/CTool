import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
for (const name of ["wolf-database-test", "wolf-runtime-test", "wolf-text-test"]) {
  const exe=fileURLToPath(new URL(`../native/build/Release/${name}.exe`,import.meta.url));
  execFileSync(exe,[],{stdio:"inherit",windowsHide:true,timeout:30000});
}
execFileSync(fileURLToPath(new URL('../native/build/Release/wolf-font-test.exe',import.meta.url)),
  [fileURLToPath(new URL('../tool_data/fonts/noto-sans-cjk-sc/NotoSansCJKsc-Regular.otf',import.meta.url))],
  {stdio:'inherit',windowsHide:true,timeout:30000});
