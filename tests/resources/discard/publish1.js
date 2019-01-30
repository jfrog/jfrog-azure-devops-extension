const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "buildDiscard",
    "buildNumber": "1"
};

testUtils.runTask(testUtils.publish, {}, inputs);
