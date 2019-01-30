const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "buildPromote",
    "buildNumber": "3"
};

testUtils.runTask(testUtils.publish, {}, inputs);
