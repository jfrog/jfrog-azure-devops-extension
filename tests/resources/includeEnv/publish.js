const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "includeEnv",
    "buildNumber": "3"
};

testUtils.runTask(testUtils.publish, {}, inputs);
