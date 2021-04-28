const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'Gradle CI Test',
    buildNumber: '3'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
