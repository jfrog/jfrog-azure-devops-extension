const testUtils = require('../../testUtils');

// Forces a CLI version older than the Package Alias minimum (2.93.0) - the task must
// still succeed, only skipping Package Alias setup with a warning.
let inputs = {
    jfrogPlatformConnection: 'mock-service',
    useCustomVersion: true,
    cliVersion: '2.92.0',
    enablePackageAlias: true,
    command: 'jf rt ping',
};

testUtils.runPlatformTask(testUtils.genericCli, {}, inputs);
