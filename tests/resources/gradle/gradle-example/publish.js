const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'Gradle Test',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
