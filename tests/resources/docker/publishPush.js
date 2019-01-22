const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "dockerTest",
    "buildNumber": "1"
};

testUtils.runTask(testUtils.publish, {}, inputs);
