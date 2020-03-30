const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'NuGet Test Ver1',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
