// Side-effect import for dev/test scripts: aborts before any DB write if pointed at production.
import { assertDevSeedEnvironment } from './guard.js';

assertDevSeedEnvironment(process.argv[1]?.split(/[\\/]/).pop() || 'dev script');
