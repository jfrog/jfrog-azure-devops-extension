const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'Gradle Test',
    buildNumber: '3',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
