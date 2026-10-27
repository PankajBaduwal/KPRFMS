// Side-effect import for CLI scripts that read or write institutional data: selects the one
// institution this process works on. Pass --tenant <code> (or --tenant=<code>), or set FC_TENANT.
// Without it, institutional models fail closed — there is no default institution.
import { setScriptTenant } from '../tenancy/context.js';
import { isValidInstitutionCode, tenantDbName } from '../tenancy/dbNames.js';

function argValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return args[i].includes('=') ? args[i].split('=')[1] : args[i + 1];
}

const code = (argValue('tenant') || process.env.FC_TENANT || '').toLowerCase();

if (code) {
  if (!isValidInstitutionCode(code)) {
    console.error(`[TENANT] "${code}" is not a valid institution code (2-20 lowercase letters or digits).`);
    process.exit(1);
  }
  setScriptTenant({ code, dbName: tenantDbName(code), institutionId: '' });
  console.log(`[TENANT] working on institution "${code}" (database ${tenantDbName(code)})`);
}
