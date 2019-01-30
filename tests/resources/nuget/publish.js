const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "NuGet",
    "buildNumber": "3"
};

testUtils.runTask(testUtils.publish, {}, inputs);