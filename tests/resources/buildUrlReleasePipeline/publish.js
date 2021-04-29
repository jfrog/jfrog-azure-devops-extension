const testUtils = require('../../testUtils');

let variables = {
    'Release.ReleaseId': '6',
    'System.TeamFoundationCollectionUri': 'https://ecosys.visualstudio.com/',
    'System.TeamProject': 'ecosys'
};

let inputs = {
    buildName: 'buildUrlReleasePipeline',
    buildNumber: '3'
};

testUtils.runArtifactoryTask(testUtils.publish, variables, inputs);
