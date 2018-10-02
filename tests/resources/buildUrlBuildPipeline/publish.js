const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildUrlBuildPipeline",
    "Build.BuildNumber": "3",
    "Build.BuildId": "5",
    "System.TeamFoundationCollectionUri": "https://ecosys.visualstudio.com/",
    "System.TeamProject": "ecosys"
};

testUtils.runTask(testUtils.publish, variables, {});
