const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "dockerTest",
    "buildNumber": "2"
};

testUtils.runTask(testUtils.publish, {}, inputs);
