const testUtils = require('../../testUtils');

// Creates a new JFrog CLI configuration and keeps it around (does not clean up on completion),
// so a later task invocation can reuse it via 'configurationName'.
let inputs = {
    jfrogPlatformConnection: 'mock-service',
    keepConfig: true,
    command: 'jf rt ping',
};

testUtils.runPlatformTask(testUtils.genericCli, {}, inputs);
