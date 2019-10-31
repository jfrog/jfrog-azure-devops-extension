const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "Go test",
    "buildNumber": "3"
};

testUtils.runTask(testUtils.publish, {}, inputs);
