const testUtils = require('../../testUtils');

let variables = {
    'Build.BuildId': '5',
    'System.TeamFoundationCollectionUri': 'https://ecosys.visualstudio.com/',
    'System.TeamProject': 'ecosys'
};

let inputs = {
    buildName: 'buildUrlBuildPipeline',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, variables, inputs);
