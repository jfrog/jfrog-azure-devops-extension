const testUtils = require('../../testUtils');

// Neither 'jfrogPlatformConnection' nor 'configurationName' is provided - the task must fail clearly.
let inputs = {
    command: 'jf rt ping',
};

testUtils.runPlatformTask(testUtils.genericCli, {}, inputs);
