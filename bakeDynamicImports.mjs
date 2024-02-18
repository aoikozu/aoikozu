import fs from "fs";
import url from "url";

const commandNames = fs.readdirSync(url.fileURLToPath(import.meta.resolve("./src/Commands")), { withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => d.name)
  .filter(n => n.endsWith(".ts") && n !== "index.ts" && n !== "_index.ts")
  .map(n => n.slice(0, -3));

fs.writeFileSync(url.fileURLToPath(import.meta.resolve("./src/Commands/_index.ts")), `
// This file was generated automatically
// Do not edit manually
// If you want to make this file up-to-date, please run 'npm run build'
import type { BaseCommand } from ".";
${commandNames.map((n, i) => `import _${n} from "./${n}";`).join("\n")}

const commands: BaseCommand[] = [
${commandNames.map(d => `  new _${d}(),`).join("\n")}
];

export default commands;
`.trimStart());