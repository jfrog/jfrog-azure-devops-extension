const testUtils = require('../../testUtils');

let inputs = {
    jfrogPlatformConnection: 'mock-service',
    registerInPath: true,
    command: 'jf rt ping',
};

testUtils.runPlatformTask(testUtils.genericCli, {}, inputs);
