const testUtils = require('../../testUtils');

let inputs = {
    jfrogPlatformConnection: 'mock-service',
    enablePackageAlias: true,
    command: 'jf rt ping',
};

testUtils.runPlatformTask(testUtils.genericCli, {}, inputs);
