const testUtils = require('../../testUtils');

// Reuses the configuration created (and kept) by 'keepConfigSetup.js', identified by name,
// without providing a service connection - and tears it down (keepConfig defaults to false).
let inputs = {
    configurationName: process.env.ADO_TEST_PERSISTED_CONFIG_NAME,
    command: 'jf rt ping',
};

testUtils.runPlatformTask(testUtils.genericCli, {}, inputs);
