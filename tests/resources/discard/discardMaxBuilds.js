const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    maxBuilds: '3',
    maxDays: '',
    excludeBuilds: '',
    deleteArtifacts: false,
    async: false
};

testUtils.runArtifactoryTask(testUtils.discard, {}, inputs);
