const testUtils = require('../../../testUtils');

let inputs = {
    "buildName": "npmTest",
    "buildNumber": "1"
};

testUtils.runTask(testUtils.publish, {}, inputs);
