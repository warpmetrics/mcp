import { writeFileSync, chmodSync } from "fs";

const cli = `#!/usr/bin/env node
import "./index.js";
`;

writeFileSync("dist/cli.js", cli);
chmodSync("dist/cli.js", 0o755);

console.log("CLI built: dist/cli.js");
